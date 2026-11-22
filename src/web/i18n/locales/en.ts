export const enCatalog = {
  common: {
    appName: 'Takolio',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
    retry: 'Try again',
    languageLabel: 'App language',
  },
  nav: {
    home: 'Home',
    fridge: 'Fridge',
    scanner: 'Scan',
    planner: 'Meal Plan',
    recipes: 'Recipes',
    shopping: 'Shopping List',
    account: 'Account',
  },
  auth: {
    continueWithApple: 'Continue with Apple',
    continueWithLine: 'Log in with LINE',
    continueWithGoogle: 'Continue with Google',
    privateRelayNotice: 'Apple Hide My Email is fully supported.',
  },
  fridge: {
    compartments: {
      fridge: 'Refrigerator',
      veg_crisper: 'Crisper Drawer',
      chilled: 'Chilled Zone (0°C)',
      freezer: 'Freezer',
      pantry: 'Pantry',
    },
    expiryUseBy: 'Use by (Food Safety)',
    expiryBestBefore: 'Best before (Quality)',
  },
  scanner: {
    scanReceipt: 'Scan Receipt',
    scanFridge: 'Scan Fridge',
    scanBarcode: 'Scan Barcode (JAN / EAN-13)',
    barcodePlaceholder: 'Enter 8–14 digit barcode',
    barcodeLookupBtn: 'Look up product',
    invalidBarcode: 'Invalid barcode check digit. Please check the digits.',
    barcodeNotFound: 'Product not found in catalog yet.',
    nutriscoreLabel: 'Nutri-Score',
    allergensDetected: 'Declared allergens',
  },
  billing: {
    upgradeTitle: 'Upgrade to Takolio Pro',
    monthlyPlan: 'Monthly Plan',
    annualPlan: 'Annual Plan',
    merchantOfRecordNotice: 'Payments & local taxes handled securely by Dodo Payments (Merchant of Record).',
    euWithdrawalWaiverCheckbox:
      'I request immediate access to Takolio Pro digital services and acknowledge that I waive my 14-day statutory right of withdrawal once access begins.',
    tokushohoLinkLabel: 'Specified Commercial Transactions Act Disclosure',
    checkoutAction: 'Continue to secure checkout',
    openCustomerPortal: 'Manage billing & tax invoices',
    cancelAtPeriodEndAction: 'Cancel auto-renewal at period end',
    awaitingKonbiniNotice: 'Konbini voucher issued — Pro activates automatically once store payment is confirmed.',
  },
  privacy: {
    title: 'Data Residency & Privacy Controls',
    residencyLabel: 'Active data region',
    aiVisionConsentLabel: 'Allow AI receipt & fridge image recognition',
    crossBorderAiConsentLabel: 'Allow encrypted cross-region AI inference when needed',
    exportDataAction: 'Download personal data (JSON)',
    deleteAccountAction: 'Delete account permanently',
    deleteConfirmPrompt: 'Type DELETE_MY_ACCOUNT to permanently erase your account and scan photos:',
    deleteConfirmPlaceholder: 'DELETE_MY_ACCOUNT',
  },
  voice: {
    nextStep: 'Next step',
    prevStep: 'Previous step',
    repeatStep: 'Repeat instruction',
    startTimer: 'Start timer',
    pauseTimer: 'Pause timer',
    unsupportedSpeech: 'Your browser does not support Web Speech recognition.',
  },
  apiErrors: {
    UNAUTHORIZED: 'Please sign in to continue.',
    EU_WITHDRAWAL_WAIVER_REQUIRED: 'Please confirm the 14-day digital withdrawal waiver before checkout.',
    INVALID_BARCODE_CHECK_DIGIT: 'The barcode check digit is invalid.',
    PAYMENT_UNAVAILABLE: 'Billing is temporarily unavailable in this region.',
    PAYMENT_PROVIDER_UNAVAILABLE: 'Unable to reach Dodo Payments right now. Please try again.',
    MISDIRECTED_SOVEREIGN_CELL: 'Your account belongs to a dedicated regional data cell.',
    ERASURE_CONFIRMATION_REQUIRED: 'Please enter DELETE_MY_ACCOUNT to confirm permanent deletion.',
    OAUTH_ACCOUNT_CONFLICT: 'This social login is already linked to another Takolio account.',
    DEFAULT_ERROR: 'Something went wrong. Please try again.',
  },
} as const;

type DeepStringRecord<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

export type UiTranslationCatalog = DeepStringRecord<typeof enCatalog>;
