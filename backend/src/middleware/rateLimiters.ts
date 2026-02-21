import rateLimit from 'express-rate-limit';

// 1. General: 1000 req / 15 min (Dev/Test Limit)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'General rate limit reached.' },
});

// 2. Strict (Sensitive Ops): 250 req / 1 min (Increased for integration tests)
export const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 250,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Strict rate limit exceeded' },
});

// 3. SHARP (Cold/Heavy Ops): 20 req / 5 min
export const sharpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'SHARP rate limit exceeded. Proving jobs are resource intensive.' },
});
