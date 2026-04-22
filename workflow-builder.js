/**
 * Shadow ToDo - Workflow Builder (drag-and-drop canvas)
 * ----------------------------------------------------------------------------
 * Modular layer that sits *on top of* workflow-ui.js. It adds:
 *   1. A draggable palette of Triggers / Conditions / Actions pulled from
 *      WorkflowEngine.TriggerTypes / ConditionFields / ActionTypes.
 *   2. Three drop zones (#wfPaletteTrigger, #wfPaletteConds, #wfPaletteActs)
 *      wired to the existing #triggerType, #conditionsList, #actionsList
 *      elements so saves use the same code path as the select-driven flow.
 *   3. An AI prompt handler that converts plain English into a JSON rule
 *      (Trigger + Conditions + Actions) via WorkflowEngine.parsePromptToRule
 *      and hydrates the canvas.
 *   4. RBAC: hides edit / test / publish buttons when canManage() is false.
 *   5. Group scope: rules are always group-scoped. A group <select> is added
 *      to the builder and can be pre-filled + locked (see openBuilder opts).
 *
 * Drag-and-drop state (single source of truth):
 *   builderState = { groupId, name, trigger, conditions: [], actions: [] }
 *   Palette tiles set
 *     e.dataTransfer.setData("application/x-wf-node",
 *       JSON.stringify({ kind: "trigger|condition|action", catalogId }))
 *   Drop zones preventDefault on dragover and splice into builderState on
 *   drop. Each zone re-renders from state — no incremental DOM mutation.
 * ----------------------------------------------------------------------------
 */
(function WorkflowBuilder(){
  "use strict";

  var engine = null;                   // lazy — WorkflowEngine IIFE may load later
  var builderState = freshState();
  var wiredOnce = false;

  function freshState(){
    return {
      id: null,
      groupId: null,
      name: "",
      state: "draft",
      trigger: null,     // { id, typeId, config }
      conditions: [],    // [{ id, fieldId, operator, value }]
      conditionLogic: "AND",
      actions: [],       // [{ id, typeId, params }]
      lockedGroup: false // true when launched from Group Settings
    };
  }

  function uid(prefix){
    return (prefix || "n_") + Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 8);
  }

  function getEngine(){
    if (engine) return engine;
    engine = window.WorkflowEngine || null;
    return engine;
  }

  // ------------------------------------------------------------ DOM scaffolding
  // The static workflow.html markup has a #ruleBuilder step-flow. We inject a
  // palette to the left and a group selector at the top of the header. If the
  // builder isn't on the page (e.g. group-settings modal), we inject a compact
  // mini-builder inside the target container.
  function ensurePalette(){
    if (document.getElementById("wfPalette")) return;
    var flow = document.getElementById("ruleFlow");
    if (!flow) return;
    var wrap = document.createElement("div");
    wrap.className = "wf-builder-wrap";
    flow.parentElement.insertBefore(wrap, flow);
    // Move the flow into the right column
    wrap.appendChild(flow);

    var palette = document.createElement("aside");
    palette.id = "wfPalette";
    palette.className = "wf-palette";
    palette.innerHTML =
      '<div class="wf-palette-section" data-kind="trigger">' +
        '<div class="wf-palette-title"><i class="fa-solid fa-bolt"></i> Triggers</div>' +
        '<div class="wf-palette-list" id="wfPalTrig"></div>' +
      '</div>' +
      '<div class="wf-palette-section" data-kind="condition">' +
        '<div class="wf-palette-title"><i class="fa-solid fa-filter"></i> Conditions</div>' +
        '<div class="wf-palette-list" id="wfPalCond"></div>' +
      '</div>' +
      '<div class="wf-palette-section" data-kind="action">' +
        '<div class="wf-palette-title"><i class="fa-solid fa-play"></i> Actions</div>' +
        '<div class="wf-palette-list" id="wfPalAct"></div>' +
      '</div>';
    wrap.insertBefore(palette, flow);
    renderPalette();
  }

  function ensureGroupSelector(){
    if (document.getElementById("wfGroupSelect")) return;
    var canvas = document.querySelector(".wf-canvas-title") ||
                 document.querySelector(".wf-canvas-header");
    if (!canvas) return;
    var row = document.createElement("div");
    row.className = "wf-group-row";
    row.innerHTML =
      '<label><i class="fa-solid fa-people-group"></i> Group</label>' +
      '<select id="wfGroupSelect"></select>' +
      '<span class="wf-group-lock" id="wfGroupLock" hidden title="Locked — opened from Group Settings">' +
        '<i class="fa-solid fa-lock"></i></span>';
    canvas.appendChild(row);
    populateGroupSelect();
    row.querySelector("#wfGroupSelect").addEventListener("change", function(e){
      builderState.groupId = e.target.value || null;
      refreshRBAC();
    });
  }

  function populateGroupSelect(){
    var sel = document.getElementById("wfGroupSelect");
    if (!sel) return;
    // Pull groups from the main app state if available
    var groups = (window.state && Array.isArray(window.state.groups)) ?
                 window.state.groups : [];
    var html = '<option value="">Select group…</option>';
    groups.forEach(function(g){
      html += '<option value="' + escapeAttr(g.id) + '">' +
              escapeHtml(g.name) + '</option>';
    });
    sel.innerHTML = html;
    if (builderState.groupId) sel.value = builderState.groupId;
    sel.disabled = !!builderState.lockedGroup;
    var lock = document.getElementById("wfGroupLock");
    if (lock) lock.hidden = !builderState.lockedGroup;
  }

  // ---------------------------------------------------------------- PALETTE
  function renderPalette(){
    var eng = getEngine();
    if (!eng) return;
    paintList("wfPalTrig",  eng.TriggerTypes,    "trigger");
    paintList("wfPalCond",  eng.ConditionFields, "condition");
    paintList("wfPalAct",   eng.ActionTypes,     "action");
  }

  function paintList(containerId, catalog, kind){
    var el = document.getElementById(containerId);
    if (!el || !catalog) return;
    var entries = Object.keys(catalog).map(function(k){ return catalog[k]; });
    el.innerHTML = entries.map(function(item){
      return '<div class="wf-pal-tile" draggable="true"' +
             ' data-kind="' + kind + '"' +
             ' data-catalog-id="' + escapeAttr(item.id) + '"' +
             ' title="' + escapeAttr(item.description || item.label) + '">' +
             '<i class="fa-solid ' + (item.icon || "fa-circle") + '"></i>' +
             '<span>' + escapeHtml(item.label) + '</span>' +
             '</div>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".wf-pal-tile"), wireTileDrag);
  }

  function wireTileDrag(tile){
    tile.addEventListener("dragstart", function(e){
      var payload = JSON.stringify({
        source: "palette",
        kind: tile.getAttribute("data-kind"),
        catalogId: tile.getAttribute("data-catalog-id")
      });
      try { e.dataTransfer.setData("application/x-wf-node", payload); } catch(_) {}
      try { e.dataTransfer.setData("text/plain", payload); } catch(_) {}
      e.dataTransfer.effectAllowed = "copy";
      tile.classList.add("wf-dragging");
    });
    tile.addEventListener("dragend", function(){
      tile.classList.remove("wf-dragging");
    });
  }

  // ---------------------------------------------------------------- DROP ZONES
  function wireDropZones(){
    wireZone("triggerStep",   "trigger");
    wireZone("conditionsStep","condition");
    wireZone("actionsStep",   "action");
  }

  function wireZone(zoneId, acceptedKind){
    var zone = document.getElementById(zoneId);
    if (!zone || zone.__wfDropWired) return;
    zone.__wfDropWired = true;

    zone.addEventListener("dragover", function(e){
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "copy"; } catch(_) {}
      zone.classList.add("wf-drop-target");
    });
    zone.addEventListener("dragleave", function(){
      zone.classList.remove("wf-drop-target");
    });
    zone.addEventListener("drop", function(e){
      e.preventDefault();
      zone.classList.remove("wf-drop-target");
      var raw = "";
      try { raw = e.dataTransfer.getData("application/x-wf-node"); } catch(_) {}
      if (!raw) { try { raw = e.dataTransfer.getData("text/plain"); } catch(_) {} }
      if (!raw) return;
      var data; try { data = JSON.parse(raw); } catch(_) { return; }
      if (data.kind !== acceptedKind) {
        flash(zone, "Can only drop " + acceptedKind + "s here");
        return;
      }
      applyDrop(data);
    });
  }

  function applyDrop(data){
    var eng = getEngine();
    if (!eng) return;
    if (data.kind === "trigger") {
      builderState.trigger = {
        id: uid("trg_"),
        typeId: data.catalogId,
        config: {}
      };
      // Mirror to the existing <select id="triggerType"> so the existing save
      // handler in workflow-ui.js picks it up unchanged.
      var sel = document.getElementById("triggerType");
      if (sel) { sel.value = data.catalogId; fireChange(sel); }
    } else if (data.kind === "condition") {
      var field = findInCatalog(eng.ConditionFields, data.catalogId);
      var defaultOp = field && field.operators && field.operators[0] || "equals";
      builderState.conditions.push({
        id: uid("cnd_"),
        fieldId: data.catalogId,
        operator: defaultOp,
        value: ""
      });
      // Trigger the existing "+ Add Condition" handler to keep DOM in sync
      var addBtn = document.querySelector('[data-action="add-condition"]') ||
                   document.getElementById("addConditionBtn");
      if (addBtn) addBtn.click();
    } else if (data.kind === "action") {
      builderState.actions.push({
        id: uid("act_"),
        typeId: data.catalogId,
        params: {}
      });
      var addActBtn = document.querySelector('[data-action="add-action"]') ||
                      document.getElementById("addActionBtn");
      if (addActBtn) addActBtn.click();
    }
    renderBadges();
  }

  function findInCatalog(catalog, id){
    if (!catalog) return null;
    var keys = Object.keys(catalog);
    for (var i = 0; i < keys.length; i++) {
      if (catalog[keys[i]].id === id) return catalog[keys[i]];
    }
    return null;
  }

  function fireChange(el){
    var ev; try { ev = new Event("change", { bubbles: true }); }
    catch(_) { ev = document.createEvent("Event"); ev.initEvent("change", true, true); }
    el.dispatchEvent(ev);
  }

  // --------------------------------------------------------------- BADGES / RBAC
  function renderBadges(){
    var zone = document.getElementById("triggerStep");
    if (zone) {
      var has = !!builderState.trigger;
      zone.classList.toggle("wf-filled", has);
    }
    var c = document.getElementById("conditionsStep");
    if (c) c.classList.toggle("wf-filled", builderState.conditions.length > 0);
    var a = document.getElementById("actionsStep");
    if (a) a.classList.toggle("wf-filled", builderState.actions.length > 0);
  }

  function refreshRBAC(){
    var eng = getEngine();
    if (!eng || !eng.canManage) return;
    var can = builderState.groupId ? eng.canManage(builderState.groupId) : false;
    var saveBtn    = document.getElementById("saveRuleBtn");
    var pubBtn     = document.getElementById("publishRuleBtn");
    var testBtn    = document.getElementById("testRuleBtn");
    var palette    = document.getElementById("wfPalette");
    [saveBtn, pubBtn, testBtn].forEach(function(b){
      if (!b) return;
      b.disabled = !can;
      b.title = can ? "" : "You need Admin or Moderator role on this group to manage rules.";
    });
    if (palette) palette.classList.toggle("wf-readonly", !can);
  }

  // --------------------------------------------------------------- AI PROMPT
  function wireAIPrompt(){
    var btn = document.getElementById("aiGenerateBtn");
    var input = document.getElementById("aiPromptInput");
    if (!btn || !input || btn.__wfWired) return;
    btn.__wfWired = true;
    btn.addEventListener("click", function(){
      runPromptToRule(input.value);
    });
    input.addEventListener("keydown", function(e){
      if (e.key === "Enter") { e.preventDefault(); runPromptToRule(input.value); }
    });
  }

  function runPromptToRule(prompt){
    var eng = getEngine();
    if (!eng || !eng.parsePromptToRule) { flashToast("Engine not ready"); return; }
    prompt = (prompt || "").trim();
    if (!prompt) { flashToast("Type what you want the rule to do first"); return; }

    var panel = document.getElementById("aiResult");
    if (panel) panel.innerHTML = '<div class="wf-ai-loading"><i class="fa-solid fa-spinner fa-spin"></i> Thinking…</div>';

    // Mock NLP latency — the engine's parsePromptToRule is already keyword-based
    setTimeout(function(){
      var parsed;
      try { parsed = eng.parsePromptToRule(prompt); }
      catch (err) { showAIError(err); return; }
      if (!parsed) { showAIError(new Error("Could not parse prompt")); return; }
      hydrateBuilderFromParsed(parsed);
      showAIPreview(parsed);
    }, 350);
  }

  function hydrateBuilderFromParsed(parsed){
    builderState = freshState();
    builderState.name = parsed.name || "Rule from prompt";
    if (parsed.trigger && parsed.trigger.type) {
      builderState.trigger = {
        id: uid("trg_"),
        typeId: parsed.trigger.type,
        config: parsed.trigger.config || {}
      };
    }
    (parsed.conditions || []).forEach(function(c){
      builderState.conditions.push({
        id: uid("cnd_"),
        fieldId: c.field || c.fieldId,
        operator: c.operator || "equals",
        value: c.value
      });
    });
    (parsed.actions || []).forEach(function(a){
      builderState.actions.push({
        id: uid("act_"),
        typeId: a.type || a.typeId,
        params: a.params || {}
      });
    });

    // Mirror into existing form controls so the existing Save handler works:
    var nameEl = document.getElementById("ruleName");
    if (nameEl) nameEl.value = builderState.name;
    var trigSel = document.getElementById("triggerType");
    if (trigSel && builderState.trigger) { trigSel.value = builderState.trigger.typeId; fireChange(trigSel); }
    renderBadges();
  }

  function showAIPreview(parsed){
    var panel = document.getElementById("aiResult");
    if (!panel) return;
    var html = '<div class="wf-ai-preview">' +
      '<h4><i class="fa-solid fa-wand-magic-sparkles"></i> Generated rule</h4>' +
      '<div class="wf-ai-row"><b>Trigger</b><span>' + escapeHtml(parsed.trigger && parsed.trigger.type || "—") + '</span></div>' +
      '<div class="wf-ai-row"><b>Conditions</b><span>' + escapeHtml(((parsed.conditions || []).length) + " condition(s)") + '</span></div>' +
      '<div class="wf-ai-row"><b>Actions</b><span>' + escapeHtml(((parsed.actions || []).length) + " action(s)") + '</span></div>' +
      '<button class="wf-btn primary" id="wfOpenBuilderFromAI"><i class="fa-solid fa-diagram-project"></i> Open in Builder</button>' +
      '</div>';
    panel.innerHTML = html;
    var open = document.getElementById("wfOpenBuilderFromAI");
    if (open) open.addEventListener("click", function(){
      if (window.ShadowWorkflowUI && typeof window.ShadowWorkflowUI.showBuilder === "function") {
        window.ShadowWorkflowUI.showBuilder(builderState);
      } else {
        // Fallback: programmatically click #newRuleBtn
        var btn = document.getElementById("newRuleBtn");
        if (btn) btn.click();
      }
    });
  }

  function showAIError(err){
    var panel = document.getElementById("aiResult");
    if (!panel) return;
    panel.innerHTML = '<div class="wf-ai-error"><i class="fa-solid fa-circle-exclamation"></i> ' +
      escapeHtml(err.message || String(err)) + '</div>';
  }

  // --------------------------------------------------------------- Public API
  function openBuilder(opts){
    opts = opts || {};
    builderState = freshState();
    if (opts.groupId) builderState.groupId = opts.groupId;
    if (opts.lockGroup) builderState.lockedGroup = true;
    ensurePalette();
    ensureGroupSelector();
    wireDropZones();
    wireAIPrompt();
    populateGroupSelect();
    renderPalette();
    renderBadges();
    refreshRBAC();
    // Defer to the existing UI to actually reveal the builder panel
    if (window.ShadowWorkflowUI && typeof window.ShadowWorkflowUI.showBuilder === "function") {
      window.ShadowWorkflowUI.showBuilder(builderState);
    } else {
      var btn = document.getElementById("newRuleBtn");
      if (btn) btn.click();
    }
  }

  function getState(){ return JSON.parse(JSON.stringify(builderState)); }

  // --------------------------------------------------------------- utils
  function escapeHtml(s){
    if (s == null) return "";
    return String(s).replace(/[&<>"\']/g, function(c){
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "\'":"&#39;" })[c];
    });
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }

  function flash(el, msg){
    if (!el) return;
    el.classList.add("wf-drop-error");
    setTimeout(function(){ el.classList.remove("wf-drop-error"); }, 600);
    flashToast(msg);
  }
  function flashToast(msg){
    var c = document.getElementById("toastContainer");
    if (!c) return;
    var t = document.createElement("div");
    t.className = "wf-toast";
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function(){ t.classList.add("show"); }, 10);
    setTimeout(function(){ t.classList.remove("show"); setTimeout(function(){ t.remove(); }, 300); }, 2400);
  }

  // --------------------------------------------------------------- boot
  function onReady(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else { fn(); }
  }

  onReady(function(){
    if (wiredOnce) return;
    wiredOnce = true;
    // Passive wiring on page load: palette & drop zones are idempotent, so they
    // can safely init even when the builder is hidden.
    ensurePalette();
    ensureGroupSelector();
    wireDropZones();
    wireAIPrompt();
    refreshRBAC();
  });

  // Expose for group-ui.js and workflow-ui.js
  window.ShadowWorkflowBuilder = {
    openBuilder: openBuilder,
    getState: getState,
    refresh: function(){
      populateGroupSelect();
      renderPalette();
      renderBadges();
      refreshRBAC();
    }
  };
})();
