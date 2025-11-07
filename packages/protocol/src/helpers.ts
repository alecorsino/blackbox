// Helper functions for Blackbox Protocol

import type { PlugFunction, AssignFunction } from './types';

/**
 * Create an immutable data update plug
 *
 * @example
 * plugs: {
 *   addToCart: assign((data, event) => ({
 *     cart: [...data.cart, event.item]
 *   }))
 * }
 */
export function assign(updater: AssignFunction): PlugFunction {
  return (data: any, event: any) => {
    const updates = updater(data, event);
    // Merge updates into new object (immutable)
    Object.assign(data, updates);
    return updates;
  };
}

/**
 * Compose plugs right-to-left (like function composition)
 *
 * @example
 * plugs: {
 *   processData: compose(
 *     sortByPrice,
 *     filterInStock,
 *     transformToUI
 *   )
 * }
 */
export function compose(...plugs: PlugFunction[]): PlugFunction {
  return async (data: any, event: any, blackbox?: any) => {
    let result = event;
    // Execute right-to-left
    for (let i = plugs.length - 1; i >= 0; i--) {
      result = await Promise.resolve(plugs[i](data, result, blackbox));
    }
    return result;
  };
}

/**
 * Chain plugs left-to-right (pipeline)
 *
 * @example
 * plugs: {
 *   fetchData: pipe(
 *     http('/api/data'),
 *     validateResponse,
 *     cache(localStorage('data'))
 *   )
 * }
 */
export function pipe(...plugs: PlugFunction[]): PlugFunction {
  return async (data: any, event: any, blackbox?: any) => {
    let result = event;
    // Execute left-to-right
    for (const plug of plugs) {
      result = await Promise.resolve(plug(data, result, blackbox));
    }
    return result;
  };
}

/**
 * Try primary plug, fallback to secondary on error
 *
 * @example
 * plugs: {
 *   robustFetch: fallback(
 *     http('/api/products'),
 *     mock(defaultProducts)
 *   )
 * }
 */
export function fallback(primary: PlugFunction, secondary: PlugFunction): PlugFunction {
  return async (data: any, event: any, blackbox?: any) => {
    try {
      return await Promise.resolve(primary(data, event, blackbox));
    } catch (error) {
      console.warn('Primary plug failed, using fallback:', error);
      return await Promise.resolve(secondary(data, event, blackbox));
    }
  };
}

/**
 * Retry a plug on failure
 *
 * @example
 * plugs: {
 *   resilientFetch: retry(http('/api/data'), { attempts: 3, delay: 1000 })
 * }
 */
export function retry(
  plug: PlugFunction,
  options: { attempts?: number; delay?: number; backoff?: number } = {}
): PlugFunction {
  const { attempts = 3, delay = 1000, backoff = 2 } = options;

  return async (data: any, event: any, blackbox?: any) => {
    let lastError: any;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await Promise.resolve(plug(data, event, blackbox));
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          console.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= backoff;
        }
      }
    }

    throw lastError;
  };
}

/**
 * Cache plug results
 *
 * @example
 * plugs: {
 *   cachedFetch: cache(http('/api/products'), { ttl: 60000 })
 * }
 */
export function cache(
  plug: PlugFunction,
  options: { ttl?: number; key?: (data: any, event: any) => string } = {}
): PlugFunction {
  const { ttl = 60000, key = (_, event) => JSON.stringify(event) } = options;
  const cache = new Map<string, { value: any; expires: number }>();

  return async (data: any, event: any, blackbox?: any) => {
    const cacheKey = key(data, event);
    const cached = cache.get(cacheKey);

    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    const result = await Promise.resolve(plug(data, event, blackbox));
    cache.set(cacheKey, {
      value: result,
      expires: Date.now() + ttl
    });

    return result;
  };
}

/**
 * Add timeout to a plug
 *
 * @example
 * plugs: {
 *   timedFetch: timeout(http('/api/data'), 5000)
 * }
 */
export function timeout(plug: PlugFunction, ms: number): PlugFunction {
  return async (data: any, event: any, blackbox?: any) => {
    return Promise.race([
      Promise.resolve(plug(data, event, blackbox)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      )
    ]);
  };
}

/**
 * Debounce plug executions
 *
 * @example
 * plugs: {
 *   debouncedSearch: debounce(http('/api/search'), 300)
 * }
 */
export function debounce(plug: PlugFunction, ms: number): PlugFunction {
  let timer: any;
  let lastPromise: Promise<any> | null = null;

  return (data: any, event: any, blackbox?: any) => {
    if (timer) clearTimeout(timer);

    lastPromise = new Promise((resolve, reject) => {
      timer = setTimeout(async () => {
        try {
          const result = await Promise.resolve(plug(data, event, blackbox));
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, ms);
    });

    return lastPromise;
  };
}

/**
 * Throttle plug executions
 *
 * @example
 * plugs: {
 *   throttledLog: throttle(logEvent, 1000)
 * }
 */
export function throttle(plug: PlugFunction, ms: number): PlugFunction {
  let lastRun = 0;

  return async (data: any, event: any, blackbox?: any) => {
    const now = Date.now();
    if (now - lastRun >= ms) {
      lastRun = now;
      return await Promise.resolve(plug(data, event, blackbox));
    }
  };
}
