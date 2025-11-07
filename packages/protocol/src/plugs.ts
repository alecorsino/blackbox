// Built-in plugs for common patterns

import type { PlugFunction } from './types';

/**
 * HTTP plug - makes REST API calls
 */
export function http(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): PlugFunction {
  return async (context: any, event: any) => {
    const fullUrl = url.startsWith('http') ? url : `${context.apiBase || ''}${url}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(context.headers || {})
      }
    };

    if (method !== 'GET' && event.payload) {
      options.body = JSON.stringify(event.payload || event);
    }

    const response = await fetch(fullUrl, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  };
}

/**
 * Memory plug - returns static data or executes a function
 */
export function memory<T>(data: T | (() => T)): PlugFunction {
  return async () => {
    return typeof data === 'function' ? (data as Function)() : data;
  };
}

/**
 * Mock plug - returns mock data after optional delay
 */
export function mock<T>(data: T, delayMs: number = 0): PlugFunction {
  return async () => {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return data;
  };
}

/**
 * LocalStorage plug - read/write to browser localStorage
 */
export function localStorage(key: string, operation: 'get' | 'set' | 'push' = 'get'): PlugFunction {
  return async (context: any, event: any) => {
    if (typeof window === 'undefined') {
      throw new Error('localStorage plug only works in browser');
    }

    switch (operation) {
      case 'get': {
        const stored = window.localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }
      case 'set': {
        window.localStorage.setItem(key, JSON.stringify(event.data || event));
        return event.data || event;
      }
      case 'push': {
        const stored = window.localStorage.getItem(key);
        const array = stored ? JSON.parse(stored) : [];
        array.push(event.data || event);
        window.localStorage.setItem(key, JSON.stringify(array));
        return array;
      }
    }
  };
}

/**
 * Console plug - logs to console
 */
export function log(message?: string): PlugFunction {
  return async (context: any, event: any) => {
    console.log(message || 'Blackbox:', { context, event });
    return event;
  };
}
