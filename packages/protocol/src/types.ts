// Core types for Blackbox Protocol v1.3

export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface DataSchemaField {
  type?: DataType;         // Optional when $ref is used
  $ref?: string;           // Reference to model: "#/models/Product"
  required?: boolean;
  default?: any;
  // Validation rules
  pattern?: string;        // Regex for strings
  min?: number;           // Min value for numbers, min length for strings/arrays
  max?: number;           // Max value for numbers, max length for strings/arrays
  minLength?: number;     // Min length for strings/arrays
  maxLength?: number;     // Max length for strings/arrays
  items?: DataSchemaField; // Schema for array items (can also use $ref)
  properties?: DataSchema; // Schema for object properties
}

export interface DataSchema {
  [key: string]: DataSchemaField;
}

export interface PhaseTransition {
  target: string;
  actions?: string | string[];
  cond?: string;
}

export type InputComputer = (data: any, event: any) => any;

export interface PhaseInvoke {
  src: string;
  input?: InputComputer;  // Compute input for the service
  onDone?: string | PhaseTransition;
  onError?: string | PhaseTransition;
}

export interface Phase {
  entry?: string | string[];  // Plugs to run when entering phase
  exit?: string | string[];   // Plugs to run when exiting phase
  on?: Record<string, string | PhaseTransition | PhaseTransition[]>;  // Support multiple guarded transitions
  invoke?: PhaseInvoke;
  use?: BlackboxModule;
  type?: 'final';
  tags?: string[];
}

export interface ActionMeta {
  label: string;
  description?: string;
  params?: DataSchema;    // Changed from Record<string, string> to support full schemas
  icon?: string;
}

// v1.3: Operation types
export type OperationType = 'service' | 'action' | 'guard';

export interface OperationMetadata {
  intent?: string;        // Logical intent (e.g., 'product-search')
  service?: string;       // Logical service name (e.g., 'ProductService')
  operation?: string;     // Logical operation name (e.g., 'search')
  specRef?: string;       // External spec reference (e.g., 'specs/openapi.yaml#/paths/~1products/get')
}

export interface OperationContract {
  type: OperationType;
  description?: string;
  input: DataSchema;
  output: DataSchema;
  metadata?: OperationMetadata;
}

export type PlugFunction = (data: any, event: any, blackbox?: any) => any | Promise<any>;
export type GuardFunction = (data: any, event: any) => boolean;
export type AssignFunction = (data: any, event: any) => Partial<any>;

// Plug metadata for introspection and runtime behavior
export interface PlugMetadata {
  fn: PlugFunction;
  description?: string;
  cacheable?: boolean;
  ttl?: number;          // Cache TTL in milliseconds
  timeout?: number;      // Timeout in milliseconds
  retries?: number;      // Number of retry attempts
}

export type Plug = PlugFunction | PlugMetadata;

export interface BlackboxConfig {
  id: string;
  version: string;
  initial?: string;

  // v1.3: Three-layer data model
  models?: Record<string, DataSchema>;      // Layer 1: Domain types (static)
  data?: DataSchema;                        // Layer 2: Machine state (can $ref models)

  phases: Record<string, Phase>;
  actions: Record<string, ActionMeta>;
  operations: Record<string, OperationContract>;  // v1.3: Protocol contracts

  // NO plugs - provided via .use() at runtime only
}

export interface BlackboxModule extends BlackboxConfig {}

export interface BlackboxState {
  phase: string;
  data: any;
  loading: boolean;
  error?: {
    message: string;
    code?: number;
  };
}

// Event history entry
export interface HistoryEntry {
  type: string;
  payload?: any;
  phase: string;
  timestamp: number;
}

// Snapshot for save/restore
export interface Snapshot {
  version: string;
  phase: string;
  data: any;
  timestamp: number;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Introspection API
export interface Introspection {
  // v1.0 methods
  allPaths(): string[][];
  allActions(): Array<{ name: string; phase: string; label: string; params?: DataSchema }>;
  getPhase(name: string): Phase | undefined;
  canReach(from: string, to: string): boolean;
  pathExists(path: string[]): boolean;

  // v1.3 methods
  getOperation(name: string): OperationContract | undefined;
  getAllOperations(): Record<string, OperationContract>;
  resolveModelRef(ref: string): DataSchema | undefined;
  validatePlugs(plugs: Record<string, Plug>): ValidationResult;
  resolveSpecRef(ref: string): string;  // Returns ref as-is for now
}

export interface Blackbox {
  can(): string[];
  do(action: string, payload?: any): void;
  where(): BlackboxState;
  isBusy(): boolean;
  hasTag(tag: string): boolean;
  on(event: 'error' | 'done' | 'change', callback: (data: any) => void): void;
  use(plugs: Record<string, Plug>): void;

  // New features from spec
  introspect(): Introspection;
  history(): HistoryEntry[];
  replay(history: HistoryEntry[]): void;
  clearHistory(): void;
  snapshot(): Snapshot;
}
