/**
 * Shared dynamic-template translator for all non-English/Vietnamese LocalePacks (`ja`, `ko`, `th`, `zh`, `it`).
 * Matches interpolated English UI phrases produced by `l(vi, en)` / `lSync(vi, en)` / `lPlanner(...)`
 * and formats them cleanly using the active pack's native templates (`{0}`, `{1}`, `{2}`).
 */

export interface DynamicPatternTemplates {
  pendingSync: string; // Pending sync ({0} changes).
  signInToSave: string; // Sign in to save {0}
  savedToFavorites: string; // Saved “{0}” to favorites
  removedFromFavorites: string; // Removed “{0}” from favorites
  unsaveTitle: string; // Unsave {0}
  saveTitle: string; // Save {0}
  reviewLinesConfirmed: string; // / {0} lines confirmed
  reviewLinesSelected: string; // / {0} lines selected
  skippedCount: string; // {0} skipped.
  elapsedTime: string; // Elapsed {0}
  viewRelatedMeals: string; // View {0} related meals
  retryAction: string; // Retry {0}
  unknownQuantitiesCount: string; // Unknown quantities · {0}
  keepingBoughtHistory: string; // Keeping {0} ({1}). Skipping only removes unchecked items; bought history is kept.
  statusBought: string;
  statusChosenByYou: string;
  quantitiesChosenCount: string; // Quantities chosen · {0} ingredients
  yourChosenAmount: string; // Your chosen amount: {0}
  skippedIngredientsCount: string; // Skipped · {0} ingredients
  chooseQuantityFor: string; // Choose quantity: {0}
  searchLabel: string; // Search {0}
  minShort: string; // {0} min
  cookOnWeekday: string; // Cook on {0}
  upToMeals: string; // Up to {0} meals
  savedRecipesCount: string; // {0} saved recipes
  addToMeal: string; // Add {0} to a meal
  servingsCount: string; // {0} servings
  replaceDishNote: string; // This dish will replace “{0}” as the {1}. Other dishes stay unchanged.
  dishesFound: string; // {0} dishes found
  needsIngredients: string; // Needs {0} ingredients
  selectedAllergies: string; // Selected allergies ({0}): {1}. Forbidden ingredients ({2}): {3}.
  sharedDemandUpdated: string; // Shared demand updated for {0} ingredients.
  sharedDemandUpdatedWithReview: string; // Shared demand updated for {0} ingredients · {1} need quantity review.
  markedBoughtFraction: string; // Marked bought: {0}/{1}
  mainDishesChosenFor: string; // Main dishes chosen for {0} meals
  mealsHaveStyleDishes: string; // {0}/{1} meals have dishes for the chosen meal style; ingredients are checked separately.
  mealsHaveAllGroups: string; // {0}/{1} meals have all required groups; ingredients are checked separately.
  exceedsStock: string; // Exceeds available stock: {0}. Please check again.
  estBudgetPair: string; // Est. {0} / {1} budget
  estExpiredDate: string; // Estimated expired ({0})
  estExpiringSoonDate: string; // Estimated expiring soon ({0})
  estExpiryDate: string; // Estimated expiry {0}
  expiredDate: string; // Expired {0}
  expiringSoonDate: string; // Expiring soon {0}
  expiresDate: string; // Expires {0}
  openedDate: string; // Opened {0}
  lowConfidencePct: string; // Low confidence {0}%
  confidencePct: string; // Confidence {0}%
  scanLimitPlan: string; // You have reached the scan limit for your current plan.
  scanLimitPlanReset: string; // You have reached the scan limit for your current plan. Quota resets on {0}.
  scanLimitFree: string; // You have used all {0} free scans for this month.
  scanLimitFreeReset: string; // You have used all {0} free scans for this month. Quota resets on {0}.
  supportId: string; // Support ID: {0}.
  recipesUsingIngredient: string; // Recipes using this ingredient ({0})
  upgradeNowFor: string; // Upgrade now for {0}
  lineItemsCount: string; // Line items ({0})
  restoreItem: string; // Restore {0}
  skipItem: string; // Skip {0}
  viewRawOcr: string; // View raw OCR and confirmed values
  viewRawOcrEdited: string; // View raw OCR and confirmed values · Edited
  saveSkippedLines: string; // Save {0} skipped lines
  addItemsToFridge: string; // Add {0} items to Fridge
  estExpiryShort: string; // est. expiry {0}
  expiresShort: string; // expires {0}
  freeScansRemaining: string; // {0}/{1} free scans remaining this month
  scanResultsReady: string; // Scan results are ready. {0} ingredients to review.
  confirmedIngredientsDot: string; // Confirmed {0} ingredients.
  scanCouldNotProcess: string; // Scan could not be processed. {0}
  confirmedIngredients: string; // Confirmed {0} ingredients
  ingredientsToReview: string; // {0} ingredients to review
  ingredientIndex: string; // Ingredient {0}
  estDays: string; // Est. {0} days
  confirmIngredientsCount: string; // Confirm ingredients ({0})
  boughtItem: string; // Bought: {0}
  markedAsBought: string; // Marked “{0}” as bought
  movedBackToBuy: string; // Moved “{0}” back to to-buy
  andMore: string; //  and {0} more
  editQuantityFor: string; // Edit quantity: {0}
  removeFromList: string; // Remove from list: {0}
  ingredientsNeedQuantity: string; // {0} ingredients need a quantity
  boughtItemsCount: string; // Bought · {0} items
  removeFromShoppingConfirm: string; // Remove “{0}” from your household shopping list.
  removeFromShoppingConfirmUnknown: string; // Remove “{0}” from your household shopping list. Items with unresolved meal-plan demand will return to the review section.
  peopleCount: string; // {0} people
  addNamedItem: string; // Add {0}
  saveFromReceipt: string; // Save {0} from receipt
  saveFromScan: string; // Save {0} from scan
  savedImportRequest: string; // Saved request to import {0} ingredients, waiting to sync. Inventory has not changed yet.
  searchRecipesFor: string; // Search recipes for “{0}”
  minsAgo: string; // {0}m ago
  hoursAgo: string; // {0}h ago
  daysAgo: string; // {0}d ago
  servingsCuisinesSpice: string; // Servings for {0} · Cuisines & spice level
  itemsCount: string; // {0} items
  otpDigit: string; // OTP digit {0}
  enterOtpSentTo: string; // Enter the 6-digit code sent to {0} to activate your account.
  resendCodeTimer: string; // Resend code · 00:{0}
  hiGreeting: string; // Hi {0} · Meal ideas matched to your ingredients
  servesWithPrep: string; // Serves {0} · {1} min prep.
  servesOnly: string; // Serves {0}.
  matchedFridgeStock: string; // {0} min · Matched to your current fridge stock.
  missingIngredientsCount: string; // Missing {0} ingredients
  fridgeFreshItems: string; // Your fridge has {0} fresh items in good shape.
  estDaysLeft: string; // Est. {0}d left
  daysLeft: string; // {0}d left
  addedToFridge: string; // Added “{0}” to your fridge
  fridgeSummaryCounts: string; // {0} items · {1} expiring soon
  useSoonCount: string; // Use soon ({0})
  freshCount: string; // Fresh ({0})
  fridgeOtherCategories: string; // Your fridge still has {0} items in other categories.
  decreaseQty: string; // Decrease {0} quantity
  increaseQty: string; // Increase {0} quantity
  detailsFor: string; // Details for {0}
  scaledRecipeTitle: string; // {0} — Scaled Recipe
  startCookingSteps: string; // Start cooking ({0} steps)
  ingredientsCount: string; // Ingredients ({0})
  inFridgeAmt: string; // In fridge ({0})
  needMoreAmt: string; // Need {0} more
  cookingStepsCount: string; // Cooking steps ({0})
  suggestedTimer: string; // Suggested timer: {0} min
  chefsTip: string; // Chef's tip: {0}
  ingredientsToBuyCount: string; // {0} ingredients to buy
  fullWeeklyScheduleCount: string; // Full weekly schedule ({0} meals)
  needToBuyCount: string; // Need to buy {0} items
  fridgeIngredientsCount: string; // Fridge ingredients ({0})
  noFridgeLotsMatch: string; // No fridge lots match “{0}”.
  recipesCount: string; // Recipes ({0})
  noRecipesMatch: string; // No recipes match “{0}”.
  minAndServings: string; // {0} min · {1} servings
  kitchenSetupStep: string; // Kitchen setup ({0}/6)
  stepOfSix: string; // Step {0}/6
  setupProgressStep: string; // Setup progress: step {0} of 6
  tableFor: string; // Table for {0}
  eggsCount: string; // {0} eggs
  matchedTasteServings: string; // Matched to your taste ({0} servings)
  sproutPersonalizing: string; // Sprout Chef is personalizing your kitchen for {0} people…
  selectedServingsPeople: string; // Selected servings: {0} people
  noQuestionsMatch: string; // No questions found matching "{0}"
  searchRecipesColon: string; // Search recipes: {0}
  familyCatalogServings: string; // Family recipe catalog · {0} servings
  searchResultsCount: string; // Search results ({0})
  missingCountOnly: string; // Missing {0}
  pageOfPages: string; // Page {0} / {1}
  pendingCompletionReview: string; // You still have a pending completion review for {0}. Finish or dismiss it before starting a new dish.
  stepSlashTotal: string; // Step {0} / {1}
  prepIngredientsServings: string; // Prep ingredients · {0} servings
  aboutTotalSteps: string; // About {0} min total · {1} steps.
  checkOffPrepCount: string; // Check off prep ingredients ({0})
  startStepByStep: string; // Start step-by-step cooking ({0} steps)
  percentComplete: string; // {0}% complete
  cookingProgressStep: string; // Cooking progress: step {0} of {1}
  stageSlashTotal: string; // Stage {0} / {1}
  stepNumber: string; // Step {0}
  recipeIngredientsSummary: string; // Recipe ingredients ({0} items · {1} servings)
  actualAmountsUsed: string; // Actual amounts used ({0} items)
}

function fmt(tpl: string, ...args: string[]): string {
  return tpl.replace(/\{(\d+)\}/g, (_, idx) => args[Number(idx)] ?? '');
}

type PatternRule = [RegExp, (m: RegExpExecArray, t: DynamicPatternTemplates) => string];

const RULES: readonly PatternRule[] = [
  [/^Pending sync \((\d+) changes?\)\.$/, (m, t) => fmt(t.pendingSync, m[1])],
  [/^Sign in to save (.+)$/, (m, t) => fmt(t.signInToSave, m[1])],
  [/^Saved “(.+)” to favorites$/, (m, t) => fmt(t.savedToFavorites, m[1])],
  [/^Removed “(.+)” from favorites$/, (m, t) => fmt(t.removedFromFavorites, m[1])],
  [/^Unsave (.+)$/, (m, t) => fmt(t.unsaveTitle, m[1])],
  [/^Save (\d+) skipped lines?$/, (m, t) => fmt(t.saveSkippedLines, m[1])],
  [/^Save (.+) from receipt$/, (m, t) => fmt(t.saveFromReceipt, m[1])],
  [/^Save (.+) from scan$/, (m, t) => fmt(t.saveFromScan, m[1])],
  [/^Save (.+)$/, (m, t) => fmt(t.saveTitle, m[1])],
  [/^\/ (\d+) lines? confirmed$/, (m, t) => fmt(t.reviewLinesConfirmed, m[1])],
  [/^\/ (\d+) lines? selected$/, (m, t) => fmt(t.reviewLinesSelected, m[1])],
  [/^(\d+) skipped\. ?$/, (m, t) => fmt(t.skippedCount, m[1])],
  [/^Elapsed (.+)$/, (m, t) => fmt(t.elapsedTime, m[1])],
  [/^View (\d+) related meals?$/, (m, t) => fmt(t.viewRelatedMeals, m[1])],
  [/^Retry (.+)$/, (m, t) => fmt(t.retryAction, m[1])],
  [/^Unknown quantities · (\d+)$/, (m, t) => fmt(t.unknownQuantitiesCount, m[1])],
  [
    /^Keeping (.+) \((bought|chosen by you)\)\. Skipping only removes unchecked items; bought history is kept\.$/,
    (m, t) => fmt(t.keepingBoughtHistory, m[1], m[2] === 'bought' ? t.statusBought : t.statusChosenByYou),
  ],
  [/^Quantities chosen · (\d+) ingredients?$/, (m, t) => fmt(t.quantitiesChosenCount, m[1])],
  [/^Your chosen amount: (.+)$/, (m, t) => fmt(t.yourChosenAmount, m[1])],
  [/^Skipped · (\d+) ingredients?$/, (m, t) => fmt(t.skippedIngredientsCount, m[1])],
  [/^Choose quantity: (.+)$/, (m, t) => fmt(t.chooseQuantityFor, m[1])],
  [/^Search recipes for “(.+)”$/, (m, t) => fmt(t.searchRecipesFor, m[1])],
  [/^Search recipes: (.+)$/, (m, t) => fmt(t.searchRecipesColon, m[1])],
  [/^Search results \((\d+)\)$/, (m, t) => fmt(t.searchResultsCount, m[1])],
  [/^Search (.+)$/, (m, t) => fmt(t.searchLabel, m[1])],
  [/^(\d+) min · (\d+) servings?$/, (m, t) => fmt(t.minAndServings, m[1], m[2])],
  [/^(\d+) min · Matched to your current fridge stock\.$/, (m, t) => fmt(t.matchedFridgeStock, m[1])],
  [/^(\d+) min$/, (m, t) => fmt(t.minShort, m[1])],
  [/^Cook on (.+)$/, (m, t) => fmt(t.cookOnWeekday, m[1])],
  [/^Up to (\d+) meals?$/, (m, t) => fmt(t.upToMeals, m[1])],
  [/^(\d+) saved recipes?$/, (m, t) => fmt(t.savedRecipesCount, m[1])],
  [/^Add (\d+) items? to Fridge$/, (m, t) => fmt(t.addItemsToFridge, m[1])],
  [/^Add (.+) to a meal$/, (m, t) => fmt(t.addToMeal, m[1])],
  [/^Add (.+)$/, (m, t) => fmt(t.addNamedItem, m[1])],
  [/^(\d+) servings?$/, (m, t) => fmt(t.servingsCount, m[1])],
  [
    /^This dish will replace “(.+)” as the (.+)\. Other dishes stay unchanged\.$/,
    (m, t) => fmt(t.replaceDishNote, m[1], m[2]),
  ],
  [/^(\d+) dishes found$/, (m, t) => fmt(t.dishesFound, m[1])],
  [/^Needs (\d+) ingredients?$/, (m, t) => fmt(t.needsIngredients, m[1])],
  [
    /^Selected allergies \((\d+)\): (.+)\. Forbidden ingredients \((\d+)\): (.+)\.$/,
    (m, t) => fmt(t.selectedAllergies, m[1], m[2], m[3], m[4]),
  ],
  [
    /^Shared demand updated for (\d+) ingredients · (\d+) need quantity review\.$/,
    (m, t) => fmt(t.sharedDemandUpdatedWithReview, m[1], m[2]),
  ],
  [/^Shared demand updated for (\d+) ingredients\.$/, (m, t) => fmt(t.sharedDemandUpdated, m[1])],
  [/^Marked bought: (\d+)\/(\d+)$/, (m, t) => fmt(t.markedBoughtFraction, m[1], m[2])],
  [/^Main dishes chosen for (\d+) meals?$/, (m, t) => fmt(t.mainDishesChosenFor, m[1])],
  [
    /^(\d+)\/(\d+) meals have dishes for the chosen meal style; ingredients are checked separately\.$/,
    (m, t) => fmt(t.mealsHaveStyleDishes, m[1], m[2]),
  ],
  [
    /^(\d+)\/(\d+) meals have all required groups; ingredients are checked separately\.$/,
    (m, t) => fmt(t.mealsHaveAllGroups, m[1], m[2]),
  ],
  [/^Exceeds available stock: (.+)\. Please check again\.$/, (m, t) => fmt(t.exceedsStock, m[1])],
  [/^Est\. (.+) \/ (.+) budget$/, (m, t) => fmt(t.estBudgetPair, m[1], m[2])],
  [/^Estimated expired \((.+)\)$/, (m, t) => fmt(t.estExpiredDate, m[1])],
  [/^Estimated expiring soon \((.+)\)$/, (m, t) => fmt(t.estExpiringSoonDate, m[1])],
  [/^Estimated expiry (.+)$/, (m, t) => fmt(t.estExpiryDate, m[1])],
  [/^Expired (.+)$/, (m, t) => fmt(t.expiredDate, m[1])],
  [/^Expiring soon (.+)$/, (m, t) => fmt(t.expiringSoonDate, m[1])],
  [/^Expires (.+)$/, (m, t) => fmt(t.expiresDate, m[1])],
  [/^Opened (.+)$/, (m, t) => fmt(t.openedDate, m[1])],
  [/^Low confidence (\d+)%$/, (m, t) => fmt(t.lowConfidencePct, m[1])],
  [/^Confidence (\d+)%$/, (m, t) => fmt(t.confidencePct, m[1])],
  [
    /^You have reached the scan limit for your current plan\. Quota resets on (.+)\.$/,
    (m, t) => fmt(t.scanLimitPlanReset, m[1]),
  ],
  [/^You have reached the scan limit for your current plan\.$/, (_m, t) => t.scanLimitPlan],
  [
    /^You have used all (\d+) free scans for this month\. Quota resets on (.+)\.$/,
    (m, t) => fmt(t.scanLimitFreeReset, m[1], m[2]),
  ],
  [/^You have used all (\d+) free scans for this month\.$/, (m, t) => fmt(t.scanLimitFree, m[1])],
  [/^Support ID: (.+)\.$/, (m, t) => fmt(t.supportId, m[1])],
  [/^Recipes using this ingredient \((\d+)\)$/, (m, t) => fmt(t.recipesUsingIngredient, m[1])],
  [/^Upgrade now for (.+)$/, (m, t) => fmt(t.upgradeNowFor, m[1])],
  [/^Line items \((\d+)\)$/, (m, t) => fmt(t.lineItemsCount, m[1])],
  [/^Restore (.+)$/, (m, t) => fmt(t.restoreItem, m[1])],
  [/^Skip (.+)$/, (m, t) => fmt(t.skipItem, m[1])],
  [/^View raw OCR and confirmed values · Edited$/, (_m, t) => t.viewRawOcrEdited],
  [/^View raw OCR and confirmed values$/, (_m, t) => t.viewRawOcr],
  [/^est\. expiry (.+)$/, (m, t) => fmt(t.estExpiryShort, m[1])],
  [/^expires (.+)$/, (m, t) => fmt(t.expiresShort, m[1])],
  [/^(\d+)\/(\d+) free scans remaining this month$/, (m, t) => fmt(t.freeScansRemaining, m[1], m[2])],
  [/^Scan results are ready\. (\d+) ingredients? to review\.$/, (m, t) => fmt(t.scanResultsReady, m[1])],
  [/^Confirmed (\d+) ingredients?\.$/, (m, t) => fmt(t.confirmedIngredientsDot, m[1])],
  [/^Confirmed (\d+) ingredients?$/, (m, t) => fmt(t.confirmedIngredients, m[1])],
  [/^Scan could not be processed\. (.+)$/, (m, t) => fmt(t.scanCouldNotProcess, m[1])],
  [/^(\d+) ingredients? to review$/, (m, t) => fmt(t.ingredientsToReview, m[1])],
  [/^Ingredient (\d+)$/, (m, t) => fmt(t.ingredientIndex, m[1])],
  [/^Est\. (\d+) days?$/, (m, t) => fmt(t.estDays, m[1])],
  [/^Confirm ingredients \((\d+)\)$/, (m, t) => fmt(t.confirmIngredientsCount, m[1])],
  [/^Bought: (.+)$/, (m, t) => fmt(t.boughtItem, m[1])],
  [/^Marked “(.+)” as bought$/, (m, t) => fmt(t.markedAsBought, m[1])],
  [/^Moved “(.+)” back to to-buy$/, (m, t) => fmt(t.movedBackToBuy, m[1])],
  [/^ and (\d+) more$/, (m, t) => fmt(t.andMore, m[1])],
  [/^Edit quantity: (.+)$/, (m, t) => fmt(t.editQuantityFor, m[1])],
  [/^Remove from list: (.+)$/, (m, t) => fmt(t.removeFromList, m[1])],
  [/^(\d+) ingredients? needs? a quantity$/, (m, t) => fmt(t.ingredientsNeedQuantity, m[1])],
  [/^Bought · (\d+) items?$/, (m, t) => fmt(t.boughtItemsCount, m[1])],
  [
    /^Remove “(.+)” from your household shopping list\. Items with unresolved meal-plan demand will return to the review section\.$/,
    (m, t) => fmt(t.removeFromShoppingConfirmUnknown, m[1]),
  ],
  [/^Remove “(.+)” from your household shopping list\.$/, (m, t) => fmt(t.removeFromShoppingConfirm, m[1])],
  [/^(\d+) (?:person|people)$/, (m, t) => fmt(t.peopleCount, m[1])],
  [
    /^Saved request to import (\d+) ingredients, waiting to sync\. Inventory has not changed yet\.$/,
    (m, t) => fmt(t.savedImportRequest, m[1]),
  ],
  [/^(\d+)m ago$/, (m, t) => fmt(t.minsAgo, m[1])],
  [/^(\d+)h ago$/, (m, t) => fmt(t.hoursAgo, m[1])],
  [/^(\d+)d ago$/, (m, t) => fmt(t.daysAgo, m[1])],
  [/^Servings for (\d+) · Cuisines & spice level$/, (m, t) => fmt(t.servingsCuisinesSpice, m[1])],
  [/^(\d+) items? · (\d+) expiring soon$/, (m, t) => fmt(t.fridgeSummaryCounts, m[1], m[2])],
  [/^(\d+) items?$/, (m, t) => fmt(t.itemsCount, m[1])],
  [/^OTP digit (\d+)$/, (m, t) => fmt(t.otpDigit, m[1])],
  [/^Enter the 6-digit code sent to (.+) to activate your account\.$/, (m, t) => fmt(t.enterOtpSentTo, m[1])],
  [/^Resend code · 00:(\d+)$/, (m, t) => fmt(t.resendCodeTimer, m[1])],
  [/^Hi (.+) · Meal ideas matched to your ingredients$/, (m, t) => fmt(t.hiGreeting, m[1])],
  [/^Serves (\d+) · (\d+) min prep\.$/, (m, t) => fmt(t.servesWithPrep, m[1], m[2])],
  [/^Serves (\d+)\.$/, (m, t) => fmt(t.servesOnly, m[1])],
  [/^Missing (\d+) ingredients?$/, (m, t) => fmt(t.missingIngredientsCount, m[1])],
  [/^Missing (\d+)$/, (m, t) => fmt(t.missingCountOnly, m[1])],
  [/^Your fridge has (\d+) fresh items? in good shape\.$/, (m, t) => fmt(t.fridgeFreshItems, m[1])],
  [/^Est\. (\d+)d left$/, (m, t) => fmt(t.estDaysLeft, m[1])],
  [/^(\d+)d left$/, (m, t) => fmt(t.daysLeft, m[1])],
  [/^Added “(.+)” to your fridge$/, (m, t) => fmt(t.addedToFridge, m[1])],
  [/^Use soon \((\d+)\)$/, (m, t) => fmt(t.useSoonCount, m[1])],
  [/^Fresh \((\d+)\)$/, (m, t) => fmt(t.freshCount, m[1])],
  [/^Your fridge still has (\d+) items? in other categories\.$/, (m, t) => fmt(t.fridgeOtherCategories, m[1])],
  [/^Decrease (.+) quantity$/, (m, t) => fmt(t.decreaseQty, m[1])],
  [/^Increase (.+) quantity$/, (m, t) => fmt(t.increaseQty, m[1])],
  [/^Details for (.+)$/, (m, t) => fmt(t.detailsFor, m[1])],
  [/^(.+) — Scaled Recipe$/, (m, t) => fmt(t.scaledRecipeTitle, m[1])],
  [/^Start cooking \((\d+) steps?\)$/, (m, t) => fmt(t.startCookingSteps, m[1])],
  [/^Ingredients \((\d+)\)$/, (m, t) => fmt(t.ingredientsCount, m[1])],
  [/^In fridge \((.+)\)$/, (m, t) => fmt(t.inFridgeAmt, m[1])],
  [/^Need (.+) more$/, (m, t) => fmt(t.needMoreAmt, m[1])],
  [/^Cooking steps \((\d+)\)$/, (m, t) => fmt(t.cookingStepsCount, m[1])],
  [/^Suggested timer: (\d+) min$/, (m, t) => fmt(t.suggestedTimer, m[1])],
  [/^Chef's tip: (.+)$/, (m, t) => fmt(t.chefsTip, m[1])],
  [/^(\d+) ingredients? to buy$/, (m, t) => fmt(t.ingredientsToBuyCount, m[1])],
  [/^Full weekly schedule \((\d+) meals?\)$/, (m, t) => fmt(t.fullWeeklyScheduleCount, m[1])],
  [/^Need to buy (\d+) items?$/, (m, t) => fmt(t.needToBuyCount, m[1])],
  [/^Fridge ingredients \((\d+)\)$/, (m, t) => fmt(t.fridgeIngredientsCount, m[1])],
  [/^No fridge lots match “(.+)”\.$/, (m, t) => fmt(t.noFridgeLotsMatch, m[1])],
  [/^Recipes \((\d+)\)$/, (m, t) => fmt(t.recipesCount, m[1])],
  [/^No recipes match “(.+)”\.$/, (m, t) => fmt(t.noRecipesMatch, m[1])],
  [/^Kitchen setup \((\d+)\/6\)$/, (m, t) => fmt(t.kitchenSetupStep, m[1])],
  [/^Step (\d+)\/6$/, (m, t) => fmt(t.stepOfSix, m[1])],
  [/^Setup progress: step (\d+) of 6$/, (m, t) => fmt(t.setupProgressStep, m[1])],
  [/^Table for (\d+)$/, (m, t) => fmt(t.tableFor, m[1])],
  [/^(\d+) eggs?$/, (m, t) => fmt(t.eggsCount, m[1])],
  [/^Matched to your taste \((\d+) servings?\)$/, (m, t) => fmt(t.matchedTasteServings, m[1])],
  [
    /^Sprout Chef is personalizing your kitchen for (\d+) (?:person|people)…$/,
    (m, t) => fmt(t.sproutPersonalizing, m[1]),
  ],
  [/^Selected servings: (\d+) (?:person|people)$/, (m, t) => fmt(t.selectedServingsPeople, m[1])],
  [/^No questions found matching "(.+)"$/, (m, t) => fmt(t.noQuestionsMatch, m[1])],
  [/^Family recipe catalog · (\d+) servings?$/, (m, t) => fmt(t.familyCatalogServings, m[1])],
  [/^Page (\d+) \/ (\d+)$/, (m, t) => fmt(t.pageOfPages, m[1], m[2])],
  [
    /^You still have a pending completion review for (.+)\. Finish or dismiss it before starting a new dish\.$/,
    (m, t) => fmt(t.pendingCompletionReview, m[1]),
  ],
  [/^Step (\d+) \/ (\d+)$/, (m, t) => fmt(t.stepSlashTotal, m[1], m[2])],
  [/^Prep ingredients · (\d+) servings?$/, (m, t) => fmt(t.prepIngredientsServings, m[1])],
  [/^About (\d+) min total · (\d+) steps?\.$/, (m, t) => fmt(t.aboutTotalSteps, m[1], m[2])],
  [/^Check off prep ingredients \((\d+)\)$/, (m, t) => fmt(t.checkOffPrepCount, m[1])],
  [/^Start step-by-step cooking \((\d+) steps?\)$/, (m, t) => fmt(t.startStepByStep, m[1])],
  [/^(\d+)% complete$/, (m, t) => fmt(t.percentComplete, m[1])],
  [/^Cooking progress: step (\d+) of (\d+)$/, (m, t) => fmt(t.cookingProgressStep, m[1], m[2])],
  [/^Stage (\d+) \/ (\d+)$/, (m, t) => fmt(t.stageSlashTotal, m[1], m[2])],
  [/^Step (\d+)$/, (m, t) => fmt(t.stepNumber, m[1])],
  [/^Recipe ingredients \((\d+) items? · (\d+) servings?\)$/, (m, t) => fmt(t.recipeIngredientsSummary, m[1], m[2])],
  [/^Actual amounts used \((\d+) items?\)$/, (m, t) => fmt(t.actualAmountsUsed, m[1])],
];

export function createDynamicTranslator(
  templates: DynamicPatternTemplates,
): (enText: string) => string | null {
  return (enText: string): string | null => {
    for (const [re, render] of RULES) {
      const m = re.exec(enText);
      if (m) return render(m, templates);
    }
    return null;
  };
}
