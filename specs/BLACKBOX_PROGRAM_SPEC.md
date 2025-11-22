# Blackbox Program Specification v1.3
## Complete Protocol Reference

> **The program is the protocol.** It declares *what* the workflow needs, not *how* it's implemented.

---

## 1. Program Structure

A Blackbox program is a JSON or TypeScript object with the following top-level properties:

```typescript
interface BlackboxProgram {
  // === REQUIRED ===
  id: string;                                    // Unique identifier
  version: string;                               // Semantic version (e.g., "1.0.0")
  phases: Record<string, Phase>;                 // State machine definition
  operations: Record<string, OperationContract>; // Protocol contracts

  // === OPTIONAL ===
  initial?: string;                              // Starting phase (defaults to first phase)
  models?: Record<string, DataSchema>;           // Domain type definitions
  data?: Record<string, DataSchemaField>;        // Machine state schema
  actions?: Record<string, ActionMeta>;          // User-triggerable events metadata
}
```

---

## 2. Core Types

### 2.1 DataSchema (Models)

Reusable type definitions for domain entities.

```typescript
interface DataSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  
  // For objects
  properties?: Record<string, DataSchemaField>;
  required?: string[];
  
  // For arrays
  items?: DataSchemaField;
  
  // Constraints
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;  // Regex for strings
}
```

### 2.2 DataSchemaField (Data & Action Params)

Individual field definition with defaults and validation.

```typescript
interface DataSchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  // Reference to model
  $ref?: string;  // e.g., "#/models/Product"
  
  // Default value
  default?: any;
  
  // Validation
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  
  // For arrays
  items?: DataSchemaField;
  
  // For objects
  properties?: Record<string, DataSchemaField>;
}
```

### 2.3 Phase

A state in the workflow with transitions and lifecycle hooks.

```typescript
interface Phase {
  // Transitions
  on?: Record<string, Transition>;  // Event → target phase or transition config
  
  // Async operation
  invoke?: InvokeConfig;
  
  // Lifecycle hooks
  entry?: string | string[];  // Operation(s) to run on entry
  exit?: string | string[];   // Operation(s) to run on exit
  
  // Metadata
  tags?: string[];            // For grouping/filtering (e.g., ['loading', 'error'])
  type?: 'final';             // Mark as terminal state
}
```

### 2.4 Transition

Configuration for phase transitions.

```typescript
type Transition = 
  | string  // Simple: just target phase name
  | {
      target: string;              // Target phase name
      cond?: string;               // Guard operation name
      actions?: string | string[]; // Operation(s) to execute during transition
    }
  | Array<{  // Multiple guarded transitions (first match wins)
      target: string;
      cond?: string;
      actions?: string | string[];
    }>;
```

### 2.5 InvokeConfig

Configuration for async operations on phase entry.

```typescript
interface InvokeConfig {
  src: string;  // Operation name
  
  // Compute input from (data, event)
  input?: InputComputer;
  
  // Success transition
  onDone?: Transition | {
    target: string;
    actions?: string | string[];
  };
  
  // Error transition
  onError?: Transition | {
    target: string;
    actions?: string | string[];
  };
}

type InputComputer = (data: any, event: any) => any;
// Note: Serialized as string in JSON programs
```

### 2.6 ActionMeta

Metadata for user-triggerable events (for discoverability).

```typescript
interface ActionMeta {
  label: string;                           // Human-readable name
  description?: string;                    // Detailed explanation
  params?: Record<string, DataSchemaField>; // Parameter schema
}
```

### 2.7 OperationContract

Protocol contract defining what a plug must do.

```typescript
interface OperationContract {
  type: 'service' | 'action' | 'guard';
  
  // I/O schemas (validated at runtime)
  input: DataSchema;
  output: DataSchema;
  
  // Documentation
  description?: string;
  
  // External spec integration
  metadata?: {
    intent?: string;        // Semantic purpose (e.g., 'product-search')
    service?: string;       // Logical service name
    operation?: string;     // Logical method name
    specRef?: string;       // JSON Pointer to external spec
                            // e.g., "specs/openapi.yaml#/paths/~1products~1search/get"
    
    // Runtime hints (optional)
    timeout?: number;       // Milliseconds
    retries?: number;       // Auto-retry count
    cacheable?: boolean;    // Enable caching
    ttl?: number;           // Cache TTL (ms)
  };
}
```

---

## 3. Operation Types Explained

### 3.1 `service` - Async Operations

**Purpose**: API calls, database queries, any async work

**Signature**: `async (data, input) => output`

**Used in**: `invoke.src`

**Example**:
```typescript
operations: {
  searchProducts: {
    type: 'service',
    input: { query: { type: 'string' } },
    output: { products: { type: 'array' } }
  }
}

// Plug implementation:
plugs: {
  searchProducts: async (data, input) => {
    const response = await fetch('/api/products?q=' + input.query);
    return { products: await response.json() };
  }
}
```

### 3.2 `action` - Sync Data Transformations

**Purpose**: Update machine state (typically via `assign`)

**Signature**: `(data, event) => updates`

**Used in**: `entry`, `exit`, `transition.actions`

**Example**:
```typescript
operations: {
  storeResults: {
    type: 'action',
    input: { event: { type: 'object' } },
    output: { type: 'object' }
  }
}

// Plug implementation:
plugs: {
  storeResults: assign((data, event) => ({
    products: event.data.products
  }))
}
```

### 3.3 `guard` - Boolean Conditions

**Purpose**: Conditional transition logic

**Signature**: `(data, event) => boolean`

**Used in**: `transition.cond`

**Example**:
```typescript
operations: {
  hasQuery: {
    type: 'guard',
    input: { event: { type: 'object' } },
    output: { type: 'boolean' }
  }
}

// Plug implementation:
plugs: {
  hasQuery: (data, event) => event.query?.length > 0
}
```

---

## 4. $ref Resolution

### Syntax

```json
{ "$ref": "#/models/ModelName" }
```

### Where $ref Can Be Used

- ✅ `data` field schemas
- ✅ `operations.input` schemas
- ✅ `operations.output` schemas
- ✅ `actions.params` schemas
- ✅ Nested in `items` (array elements)
- ✅ Nested in `properties` (object fields)

### Resolution Rules

1. `#/models/Product` → looks up `models.Product`
2. Deep resolution (follows nested $refs)
3. Circular refs → validation error
4. Missing ref → validation error

### Example

```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    }
  }
}

data: {
  products: {
    type: 'array',
    items: { $ref: '#/models/Product' }  // References model
  }
}

operations: {
  searchProducts: {
    type: 'service',
    input: { query: { type: 'string' } },
    output: {
      products: {
        type: 'array',
        items: { $ref: '#/models/Product' }  // Same model
      }
    }
  }
}
```

---

## 5. Complete Example: Shopping Checkout

This example demonstrates **every single property** available in the protocol.

```typescript
{
  // === IDENTITY ===
  "id": "shopping-checkout-flow",
  "version": "1.3.0",
  "initial": "browsing",  // Optional: start here

  // === DOMAIN TYPES ===
  "models": {
    "Product": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "price": { "type": "number" },
        "inStock": { "type": "boolean" },
        "category": { "type": "string" }
      },
      "required": ["id", "name", "price"]
    },
    
    "CartItem": {
      "type": "object",
      "properties": {
        "productId": { "type": "string" },
        "quantity": { "type": "number" },
        "addedAt": { "type": "string" }
      },
      "required": ["productId", "quantity"]
    },
    
    "Address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" },
        "zipCode": { "type": "string" },
        "country": { "type": "string" }
      },
      "required": ["street", "city", "zipCode", "country"]
    },
    
    "PaymentMethod": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "last4": { "type": "string" }
      },
      "required": ["type"]
    }
  },

  // === MACHINE STATE ===
  "data": {
    // Domain entities (via $ref)
    "products": {
      "type": "array",
      "items": { "$ref": "#/models/Product" },
      "default": []
    },
    
    "cart": {
      "type": "array",
      "items": { "$ref": "#/models/CartItem" },
      "default": []
    },
    
    "shippingAddress": {
      "$ref": "#/models/Address",
      "required": false
    },
    
    "paymentMethod": {
      "$ref": "#/models/PaymentMethod",
      "required": false
    },
    
    // Free-form app state
    "query": {
      "type": "string",
      "default": "",
      "maxLength": 100
    },
    
    "filters": {
      "type": "object",
      "properties": {
        "category": { "type": "string" },
        "minPrice": { "type": "number", "min": 0 },
        "maxPrice": { "type": "number", "min": 0 },
        "inStockOnly": { "type": "boolean", "default": true }
      },
      "default": {}
    },
    
    "selectedProductId": {
      "type": "string",
      "required": false
    },
    
    "orderId": {
      "type": "string",
      "required": false
    },
    
    "total": {
      "type": "number",
      "default": 0,
      "min": 0
    },
    
    "discount": {
      "type": "number",
      "default": 0,
      "min": 0,
      "max": 100
    },
    
    // UI state
    "showPromo": {
      "type": "boolean",
      "default": false
    },
    
    "theme": {
      "type": "string",
      "default": "light",
      "pattern": "^(light|dark)$"
    },
    
    "step": {
      "type": "number",
      "default": 1,
      "min": 1,
      "max": 5
    },
    
    // Counters
    "retryCount": {
      "type": "number",
      "default": 0,
      "min": 0
    }
  },

  // === USER ACTIONS ===
  "actions": {
    "SEARCH": {
      "label": "Search products",
      "description": "Search the product catalog by keyword",
      "params": {
        "query": {
          "type": "string",
          "required": true,
          "minLength": 1,
          "maxLength": 100
        },
        "filters": {
          "type": "object",
          "required": false,
          "properties": {
            "category": { "type": "string" }
          }
        }
      }
    },
    
    "VIEW_PRODUCT": {
      "label": "View product details",
      "params": {
        "productId": {
          "type": "string",
          "required": true
        }
      }
    },
    
    "ADD_TO_CART": {
      "label": "Add to cart",
      "description": "Add one or more products to your shopping cart",
      "params": {
        "productId": {
          "type": "string",
          "required": true
        },
        "quantity": {
          "type": "number",
          "default": 1,
          "min": 1,
          "max": 99
        }
      }
    },
    
    "REMOVE_FROM_CART": {
      "label": "Remove from cart",
      "params": {
        "productId": {
          "type": "string",
          "required": true
        }
      }
    },
    
    "UPDATE_QUANTITY": {
      "label": "Update quantity",
      "params": {
        "productId": {
          "type": "string",
          "required": true
        },
        "quantity": {
          "type": "number",
          "required": true,
          "min": 1,
          "max": 99
        }
      }
    },
    
    "APPLY_COUPON": {
      "label": "Apply discount coupon",
      "params": {
        "code": {
          "type": "string",
          "required": true,
          "pattern": "^[A-Z0-9]{6,10}$"
        }
      }
    },
    
    "CHECKOUT": {
      "label": "Proceed to checkout"
    },
    
    "SET_SHIPPING": {
      "label": "Set shipping address",
      "params": {
        "address": {
          "$ref": "#/models/Address",
          "required": true
        }
      }
    },
    
    "SET_PAYMENT": {
      "label": "Set payment method",
      "params": {
        "method": {
          "$ref": "#/models/PaymentMethod",
          "required": true
        }
      }
    },
    
    "PAY": {
      "label": "Complete payment"
    },
    
    "RETRY": {
      "label": "Retry"
    },
    
    "CANCEL": {
      "label": "Cancel order"
    },
    
    "CONTINUE_SHOPPING": {
      "label": "Continue shopping"
    }
  },

  // === OPERATIONS (Protocol Contracts) ===
  "operations": {
    // === SERVICE OPERATIONS (Async) ===
    
    "searchProducts": {
      "type": "service",
      "description": "Search product catalog with filters",
      "input": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "filters": {
            "type": "object",
            "properties": {
              "category": { "type": "string" },
              "minPrice": { "type": "number" },
              "maxPrice": { "type": "number" }
            }
          }
        },
        "required": ["query"]
      },
      "output": {
        "type": "object",
        "properties": {
          "products": {
            "type": "array",
            "items": { "$ref": "#/models/Product" }
          },
          "totalCount": { "type": "number" }
        },
        "required": ["products"]
      },
      "metadata": {
        "intent": "product-search",
        "service": "ProductService",
        "operation": "search",
        "specRef": "specs/shopping-api.yaml#/paths/~1products~1search/get",
        "timeout": 5000,
        "retries": 3,
        "cacheable": true,
        "ttl": 60000
      }
    },
    
    "getProductDetails": {
      "type": "service",
      "description": "Fetch detailed information for a single product",
      "input": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" }
        },
        "required": ["productId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "product": { "$ref": "#/models/Product" },
          "recommendations": {
            "type": "array",
            "items": { "$ref": "#/models/Product" }
          }
        },
        "required": ["product"]
      },
      "metadata": {
        "specRef": "specs/shopping-api.yaml#/paths/~1products~1{id}/get",
        "cacheable": true
      }
    },
    
    "addToCartAPI": {
      "type": "service",
      "description": "Add item to cart on backend",
      "input": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" },
          "quantity": { "type": "number" }
        },
        "required": ["productId", "quantity"]
      },
      "output": {
        "type": "object",
        "properties": {
          "cartItem": { "$ref": "#/models/CartItem" },
          "cartTotal": { "type": "number" }
        },
        "required": ["cartItem"]
      },
      "metadata": {
        "specRef": "specs/shopping-api.yaml#/paths/~1cart~1items/post"
      }
    },
    
    "removeFromCartAPI": {
      "type": "service",
      "input": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" }
        },
        "required": ["productId"]
      },
      "output": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" }
        }
      },
      "metadata": {
        "specRef": "specs/shopping-api.yaml#/paths/~1cart~1items~1{id}/delete"
      }
    },
    
    "validateCoupon": {
      "type": "service",
      "input": {
        "type": "object",
        "properties": {
          "code": { "type": "string" }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "valid": { "type": "boolean" },
          "discount": { "type": "number" }
        }
      }
    },
    
    "processPayment": {
      "type": "service",
      "description": "Process payment transaction",
      "input": {
        "type": "object",
        "properties": {
          "orderId": { "type": "string" },
          "amount": { "type": "number" },
          "paymentMethod": { "$ref": "#/models/PaymentMethod" }
        },
        "required": ["orderId", "amount", "paymentMethod"]
      },
      "output": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "transactionId": { "type": "string" },
          "status": { "type": "string" }
        },
        "required": ["success"]
      },
      "metadata": {
        "specRef": "specs/payment-api.yaml#/paths/~1payments/post",
        "timeout": 30000
      }
    },
    
    "createOrder": {
      "type": "service",
      "input": {
        "type": "object",
        "properties": {
          "cart": {
            "type": "array",
            "items": { "$ref": "#/models/CartItem" }
          },
          "shippingAddress": { "$ref": "#/models/Address" },
          "total": { "type": "number" }
        }
      },
      "output": {
        "type": "object",
        "properties": {
          "orderId": { "type": "string" },
          "estimatedDelivery": { "type": "string" }
        },
        "required": ["orderId"]
      }
    },
    
    // === ACTION OPERATIONS (Sync) ===
    
    "storeSearchResults": {
      "type": "action",
      "description": "Store search results in machine state",
      "input": {
        "type": "object",
        "properties": {
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "object"
      }
    },
    
    "storeProductDetails": {
      "type": "action",
      "input": {
        "type": "object",
        "properties": {
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "object"
      }
    },
    
    "addItemToCart": {
      "type": "action",
      "description": "Add item to local cart state",
      "input": {
        "type": "object",
        "properties": {
          "data": { "type": "object" },
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "object"
      }
    },
    
    "removeItemFromCart": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    "updateCartQuantity": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    "calculateTotal": {
      "type": "action",
      "description": "Calculate cart total with discounts",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object",
        "properties": {
          "total": { "type": "number" }
        }
      }
    },
    
    "applyDiscount": {
      "type": "action",
      "input": {
        "type": "object",
        "properties": {
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "object"
      }
    },
    
    "storeShippingAddress": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    "storePaymentMethod": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    "storeOrderId": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    "incrementRetry": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object",
        "properties": {
          "retryCount": { "type": "number" }
        }
      }
    },
    
    "resetRetry": {
      "type": "action",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object",
        "properties": {
          "retryCount": { "type": "number" }
        }
      }
    },
    
    "logError": {
      "type": "action",
      "description": "Log error for debugging",
      "input": {
        "type": "object",
        "properties": {
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "object"
      }
    },
    
    "trackPageView": {
      "type": "action",
      "description": "Track analytics event",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "object"
      }
    },
    
    // === GUARD OPERATIONS (Boolean) ===
    
    "hasQuery": {
      "type": "guard",
      "description": "Check if search query is provided",
      "input": {
        "type": "object",
        "properties": {
          "event": { "type": "object" }
        }
      },
      "output": {
        "type": "boolean"
      }
    },
    
    "hasCartItems": {
      "type": "guard",
      "description": "Check if cart has items",
      "input": {
        "type": "object",
        "properties": {
          "data": { "type": "object" }
        }
      },
      "output": {
        "type": "boolean"
      }
    },
    
    "hasShippingAddress": {
      "type": "guard",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "boolean"
      }
    },
    
    "hasPaymentMethod": {
      "type": "guard",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "boolean"
      }
    },
    
    "canRetry": {
      "type": "guard",
      "description": "Check if retry limit not exceeded",
      "input": {
        "type": "object",
        "properties": {
          "data": { "type": "object" }
        }
      },
      "output": {
        "type": "boolean"
      }
    },
    
    "isValidProductId": {
      "type": "guard",
      "input": {
        "type": "object"
      },
      "output": {
        "type": "boolean"
      }
    }
  },

  // === STATE MACHINE ===
  "phases": {
    "browsing": {
      "tags": ["interactive"],
      "entry": "trackPageView",
      "on": {
        "SEARCH": {
          "target": "searching",
          "cond": "hasQuery"
        },
        "VIEW_PRODUCT": {
          "target": "viewingProduct",
          "cond": "isValidProductId"
        },
        "CHECKOUT": {
          "target": "reviewingCart",
          "cond": "hasCartItems"
        }
      }
    },
    
    "searching": {
      "tags": ["loading"],
      "invoke": {
        "src": "searchProducts",
        "input": "(data, event) => ({ query: event.query, filters: event.filters || data.filters })",
        "onDone": {
          "target": "searchResults",
          "actions": "storeSearchResults"
        },
        "onError": {
          "target": "searchError",
          "actions": "logError"
        }
      }
    },
    
    "searchResults": {
      "tags": ["interactive"],
      "on": {
        "VIEW_PRODUCT": {
          "target": "viewingProduct",
          "cond": "isValidProductId"
        },
        "ADD_TO_CART": {
          "target": "addingToCart"
        },
        "SEARCH": {
          "target": "searching",
          "cond": "hasQuery"
        },
        "CHECKOUT": {
          "target": "reviewingCart",
          "cond": "hasCartItems"
        }
      }
    },
    
    "searchError": {
      "tags": ["error"],
      "on": {
        "RETRY": "searching",
        "CANCEL": "browsing"
      }
    },
    
    "viewingProduct": {
      "tags": ["interactive"],
      "entry": "trackPageView",
      "invoke": {
        "src": "getProductDetails",
        "input": "(data, event) => ({ productId: event.productId })",
        "onDone": {
          "target": "productDetailsLoaded",
          "actions": "storeProductDetails"
        },
        "onError": "browsing"
      }
    },
    
    "productDetailsLoaded": {
      "tags": ["interactive"],
      "on": {
        "ADD_TO_CART": "addingToCart",
        "CONTINUE_SHOPPING": "browsing"
      }
    },
    
    "addingToCart": {
      "tags": ["loading"],
      "invoke": {
        "src": "addToCartAPI",
        "input": "(data, event) => ({ productId: event.productId, quantity: event.quantity || 1 })",
        "onDone": {
          "target": "cartUpdated",
          "actions": ["addItemToCart", "calculateTotal"]
        },
        "onError": {
          "target": "searchResults",
          "actions": "logError"
        }
      }
    },
    
    "cartUpdated": {
      "tags": ["interactive"],
      "on": {
        "CONTINUE_SHOPPING": "browsing",
        "CHECKOUT": "reviewingCart"
      }
    },
    
    "reviewingCart": {
      "tags": ["interactive"],
      "entry": ["calculateTotal", "trackPageView"],
      "on": {
        "REMOVE_FROM_CART": "removingFromCart",
        "UPDATE_QUANTITY": {
          "target": "reviewingCart",
          "actions": ["updateCartQuantity", "calculateTotal"]
        },
        "APPLY_COUPON": "validatingCoupon",
        "CHECKOUT": {
          "target": "enteringShipping",
          "cond": "hasCartItems"
        },
        "CONTINUE_SHOPPING": "browsing"
      }
    },
    
    "removingFromCart": {
      "tags": ["loading"],
      "invoke": {
        "src": "removeFromCartAPI",
        "input": "(data, event) => ({ productId: event.productId })",
        "onDone": {
          "target": "reviewingCart",
          "actions": ["removeItemFromCart", "calculateTotal"]
        },
        "onError": "reviewingCart"
      }
    },
    
    "validatingCoupon": {
      "tags": ["loading"],
      "invoke": {
        "src": "validateCoupon",
        "input": "(data, event) => ({ code: event.code })",
        "onDone": {
          "target": "reviewingCart",
          "actions": ["applyDiscount", "calculateTotal"]
        },
        "onError": "reviewingCart"
      }
    },
    
    "enteringShipping": {
      "tags": ["interactive"],
      "entry": "trackPageView",
      "on": {
        "SET_SHIPPING": {
          "target": "enteringPayment",
          "actions": "storeShippingAddress"
        },
        "CANCEL": "reviewingCart"
      }
    },
    
    "enteringPayment": {
      "tags": ["interactive"],
      "entry": "trackPageView",
      "on": {
        "SET_PAYMENT": {
          "target": "confirmingOrder",
          "actions": "storePaymentMethod"
        },
        "CANCEL": "enteringShipping"
      }
    },
    
    "confirmingOrder": {
      "tags": ["interactive"],
      "on": {
        "PAY": {
          "target": "creatingOrder",
          "cond": "hasPaymentMethod",
          "actions": "resetRetry"
        },
        "CANCEL": "reviewingCart"
      }
    },
    
    "creatingOrder": {
      "tags": ["loading"],
      "invoke": {
        "src": "createOrder",
        "input": "(data) => ({ cart: data.cart, shippingAddress: data.shippingAddress, total: data.total })",
        "onDone": {
          "target": "processingPayment",
          "actions": "storeOrderId"
        },
        "onError": {
          "target": "orderCreationFailed",
          "actions": "logError"
        }
      }
    },
    
    "processingPayment": {
      "tags": ["loading"],
      "invoke": {
        "src": "processPayment",
        "input": "(data) => ({ orderId: data.orderId, amount: data.total, paymentMethod: data.paymentMethod })",
        "onDone": [
          {
            "target": "paymentCompleted",
            "cond": "(data, event) => event.data.success === true"
          },
          {
            "target": "paymentFailed",
            "actions": "logError"
          }
        ],
        "onError": {
          "target": "paymentFailed",
          "actions": ["logError", "incrementRetry"]
        }
      }
    },
    
    "paymentFailed": {
      "tags": ["error"],
      "on": {
        "RETRY": [
          {
            "target": "processingPayment",
            "cond": "canRetry"
          },
          {
            "target": "maxRetriesExceeded"
          }
        ],
        "CANCEL": "reviewingCart"
      }
    },
    
    "maxRetriesExceeded": {
      "tags": ["error"],
      "on": {
        "CANCEL": "reviewingCart"
      }
    },
    
    "orderCreationFailed": {
      "tags": ["error"],
      "on": {
        "RETRY": "creatingOrder",
        "CANCEL": "reviewingCart"
      }
    },
    
    "paymentCompleted": {
      "tags": ["success"],
      "type": "final",
      "entry": "trackPageView"
    }
  }
}
```

---

## 6. Validation Rules

### Program-Level

1. ✅ `id` must be non-empty string
2. ✅ `version` must match semver pattern `^\d+\.\d+\.\d+$`
3. ✅ `initial` (if present) must reference existing phase
4. ✅ `phases` must have at least one phase
5. ✅ `operations` must be present

### Phase-Level

1. ✅ `on` event names should match `actions` keys (warning if not)
2. ✅ `on` targets must reference existing phases
3. ✅ `invoke.src` must reference existing operation
4. ✅ `invoke` operation must be type `service`
5. ✅ `entry`/`exit` must reference existing operations
6. ✅ `entry`/`exit` operations should be type `action` (warning if `service`)
7. ✅ `cond` must reference existing operation of type `guard`
8. ✅ `actions` must reference existing operations of type `action`
9. ✅ Final phases (`type: 'final'`) cannot have `on` transitions

### Operation-Level

1. ✅ `type` must be one of: `service`, `action`, `guard`
2. ✅ `input` and `output` are required
3. ✅ `output` for guards must be `{ type: 'boolean' }`
4. ✅ `metadata.specRef` must be valid JSON Pointer (if present)

### Data-Level

1. ✅ `$ref` must start with `#/models/`
2. ✅ Referenced model must exist in `models`
3. ✅ No circular references in `$ref` chains
4. ✅ `default` must match field `type`
5. ✅ `min` <= `max` (if both present)
6. ✅ `minLength` <= `maxLength` (if both present)

### Action-Level

1. ✅ `label` is required
2. ✅ `params` schemas can use `$ref`

---

## 7. Notes on Serialization

### TypeScript vs JSON Programs

**TypeScript** (`.program.ts`):
```typescript
export default {
  invoke: {
    input: (data, event) => ({ query: event.query })  // Real function
  }
}
```

**JSON** (`.program.json`):
```json
{
  "invoke": {
    "input": "(data, event) => ({ query: event.query })"  // String
  }
}
```

Runtime must parse function strings in JSON programs.

### InputComputer Serialization

```typescript
// In TypeScript program:
input: (data, event) => ({ query: event.query })

// Serialized to JSON:
"input": "(data, event) => ({ query: event.query })"

// Runtime deserializes:
const inputFn = new Function('data', 'event', 
  'return (' + input + ')(data, event)'
);
```

---

## 8. Complete JSON Schema

See section 9 in the main spec document for the formal JSON Schema definition.

---

**End of Protocol Specification**

This document defines the complete structure of a Blackbox program. All properties shown in the example are valid and demonstrate the full capabilities of the protocol.
