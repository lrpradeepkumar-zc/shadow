#!/bin/bash
# ============================================================
# Shadow ToDo - Approval Workflow Feature Deployment Script
# ============================================================
# This script automates the git workflow for deploying the
# approval workflow feature branch to the remote repository.
#
# Usage: chmod +x deploy-approval-workflow.sh && ./deploy-approval-workflow.sh
# ============================================================

set -e  # Exit on any error

# Configuration
REPO_URL="https://github.com/lrpradeepkumar-zc/shadow.git"
BRANCH_NAME="feature/approval-workflow"
COMMIT_MSG="feat(approval): implement structured approval workflow system

- Add approval-backend.js: IndexedDB-powered state machine with
  three states (Pending Approval, Approved, Changes Requested),
    single active request constraint, task field locking, immutable
      audit trail, and in-flight preservation logic

      - Add approval-ui.js: Frontend components including Request Approval
        button (visible to owners/assignees only), approver decision
          interface (Approve/Reject/Request Changes), lock indicators
            with padlock UI, modal dialogs, notification bell, and
              audit trail timeline

              - Add approval.css: Complete styling with dark/light theme support,
                status banners, decision panels, modal animations, toast
                  notifications, and responsive design

                  - Add deploy-approval-workflow.sh: Automated git deployment script

                  Implements PRD requirements:
                    - Administrative controls (group-level toggle, mandate approval)
                      - Request initiation with 500-char note and approver selection
                        - Task locking mechanism (core fields read-only during review)
                          - Approver decision interface with mandatory rejection categories
                            - Immutable timestamped audit trail
                              - In-app and simulated email notifications"

                              # Colors for output
                              GREEN='\033[0;32m'
                              BLUE='\033[0;34m'
                              YELLOW='\033[1;33m'
                              RED='\033[0;31m'
                              NC='\033[0m' # No Color

                              echo -e "${BLUE}============================================${NC}"
                              echo -e "${BLUE}  Shadow ToDo - Approval Workflow Deploy${NC}"
                              echo -e "${BLUE}============================================${NC}"
                              echo ""

                              # Step 1: Check if git is available
                              echo -e "${YELLOW}[1/6]${NC} Checking git installation..."
                              if ! command -v git &> /dev/null; then
                                  echo -e "${RED}Error: git is not installed. Please install git first.${NC}"
                                      exit 1
                                      fi
                                      echo -e "${GREEN}  ✓ git found: $(git --version)${NC}"

                                      # Step 2: Check if we're in a git repo, or clone
                                      echo -e "${YELLOW}[2/6]${NC} Checking repository..."
                                      if [ -d ".git" ]; then
                                          echo -e "${GREEN}  ✓ Already in a git repository${NC}"
                                              # Make sure remote is set
                                                  if ! git remote get-url origin &> /dev/null; then
                                                          git remote add origin "$REPO_URL"
                                                                  echo -e "${GREEN}  ✓ Remote origin added${NC}"
                                                                      fi
                                                                      else
                                                                          echo -e "  Cloning repository..."
                                                                              git clone "$REPO_URL" shadow-todo
                                                                                  cd shadow-todo
                                                                                      echo -e "${GREEN}  ✓ Repository cloned${NC}"
                                                                                      fi

                                                                                      # Step 3: Fetch latest and create/switch to feature branch
                                                                                      echo -e "${YELLOW}[3/6]${NC} Setting up feature branch..."
                                                                                      git fetch origin 2>/dev/null || true

                                                                                      if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
                                                                                          git checkout "$BRANCH_NAME"
                                                                                              echo -e "${GREEN}  ✓ Switched to existing branch: $BRANCH_NAME${NC}"
                                                                                              else
                                                                                                  git checkout -b "$BRANCH_NAME" origin/main 2>/dev/null || git checkout -b "$BRANCH_NAME"
                                                                                                      echo -e "${GREEN}  ✓ Created and switched to: $BRANCH_NAME${NC}"
                                                                                                      fi
                                                                                                      
                                                                                                      # Step 4: Verify approval workflow files exist
                                                                                                      echo -e "${YELLOW}[4/6]${NC} Verifying approval workflow files..."
                                                                                                      FILES=(
                                                                                                          "approval-backend.js"
                                                                                                              "approval-ui.js"
                                                                                                                  "approval.css"
                                                                                                                      "deploy-approval-workflow.sh"
                                                                                                                      )
                                                                                                                      
                                                                                                                      MISSING=0
                                                                                                                      for file in "${FILES[@]}"; do
                                                                                                                          if [ -f "$file" ]; then
                                                                                                                                  echo -e "${GREEN}  ✓ $file${NC}"
                                                                                                                                      else
                                                                                                                                              echo -e "${RED}  ✗ $file (missing)${NC}"
                                                                                                                                                      MISSING=1
                                                                                                                                                          fi
                                                                                                                                                          done
                                                                                                                                                          
                                                                                                                                                          if [ $MISSING -eq 1 ]; then
                                                                                                                                                              echo -e "${RED}Error: Some files are missing. Please ensure all approval workflow files are present.${NC}"
                                                                                                                                                                  exit 1
                                                                                                                                                                  fi
                                                                                                                                                                  
                                                                                                                                                                  # Step 5: Stage and commit
                                                                                                                                                                  echo -e "${YELLOW}[5/6]${NC} Staging and committing changes..."
                                                                                                                                                                  git add approval-backend.js approval-ui.js approval.css deploy-approval-workflow.sh
                                                                                                                                                                  
                                                                                                                                                                  # Check if there are changes to commit
                                                                                                                                                                  if git diff --cached --quiet; then
                                                                                                                                                                      echo -e "${YELLOW}  No new changes to commit (files already committed)${NC}"
                                                                                                                                                                      else
                                                                                                                                                                          git commit -m "$COMMIT_MSG"
                                                                                                                                                                              echo -e "${GREEN}  ✓ Changes committed successfully${NC}"
                                                                                                                                                                              fi
                                                                                                                                                                              
                                                                                                                                                                              # Step 6: Push to remote
                                                                                                                                                                              echo -e "${YELLOW}[6/6]${NC} Pushing to remote..."
                                                                                                                                                                              git push -u origin "$BRANCH_NAME"
                                                                                                                                                                              echo -e "${GREEN}  ✓ Pushed to origin/$BRANCH_NAME${NC}"
                                                                                                                                                                              
                                                                                                                                                                              echo ""
                                                                                                                                                                              echo -e "${GREEN}============================================${NC}"
                                                                                                                                                                              echo -e "${GREEN}  Deployment Complete!${NC}"
                                                                                                                                                                              echo -e "${GREEN}============================================${NC}"
                                                                                                                                                                              echo ""
                                                                                                                                                                              echo -e "Branch:  ${BLUE}$BRANCH_NAME${NC}"
                                                                                                                                                                              echo -e "Remote:  ${BLUE}$REPO_URL${NC}"
                                                                                                                                                                              echo ""
                                                                                                                                                                              echo -e "Next steps:"
                                                                                                                                                                              echo -e "  1. Create a Pull Request: ${BLUE}https://github.com/lrpradeepkumar-zc/shadow/compare/main...$BRANCH_NAME${NC}"
                                                                                                                                                                              echo -e "  2. Request code review from team members"
                                                                                                                                                                              echo -e "  3. Merge after approval"
                                                                                                                                                                              echo ""
                                                                                                                                                                              echo -e "${YELLOW}Files deployed:${NC}"
                                                                                                                                                                              echo -e "  - approval-backend.js  (Backend: State machine, DB schema, audit trail)"
                                                                                                                                                                              echo -e "  - approval-ui.js       (Frontend: UI components, modals, lock indicators)"
                                                                                                                                                                              echo -e "  - approval.css         (Styles: Dark/light theme, animations)"
                                                                                                                                                                              echo -e "  - deploy-approval-workflow.sh (This deployment script)"
                                                                                                                                                                              echo ""
