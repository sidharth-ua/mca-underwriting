export const config = {
  app: {
    name: 'MCA Underwriting Platform',
    version: '1.0.0',
  },
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['application/pdf'],
  },
  cache: {
    dealCacheTime: 5 * 60 * 1000, // 5 minutes
  },
  scoring: {
    weights: {
      revenue: 0.30,
      expense: 0.15,
      debt: 0.30,
      risk: 0.25,
    },
  },
  riskTiers: {
    A: { min: 80, max: 100, label: 'Low Risk' },
    B: { min: 65, max: 79, label: 'Moderate Risk' },
    C: { min: 50, max: 64, label: 'Elevated Risk' },
    D: { min: 0, max: 49, label: 'High Risk' },
  },
  stackingStatus: {
    CLEAN: { maxMcas: 1, label: 'Clean' },
    STACKED: { maxMcas: 3, label: 'Stacked' },
    HEAVY: { maxMcas: Infinity, label: 'Heavy Stack' },
  },
} as const

export type Config = typeof config
