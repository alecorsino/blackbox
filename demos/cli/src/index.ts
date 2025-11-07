// Blackbox Protocol CLI v1.3
// Demonstrates separation of program (protocol) from plugs (implementation)

import * as readline from 'readline';
import shoppingProgram from './shopping.blackbox';
import { createBlackbox, mock, assign } from '@blackbox/protocol';
import type { Blackbox, ActionMeta, Plug } from '@blackbox/protocol';

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

// v1.3: Plugs are separate from program - pure implementation (HOW APIs work)
const plugs: Record<string, Plug> = {
  // Service plugs (async operations)
  searchProducts: mock(
    {
      products: [
        { id: '1', name: 'Laptop Pro', price: 1299 },
        { id: '2', name: 'Wireless Mouse', price: 29 },
        { id: '3', name: 'Mechanical Keyboard', price: 149 },
        { id: '4', name: 'USB-C Hub', price: 79 }
      ]
    },
    500
  ),

  addToCart: async (data: any, input: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    // input contains { productId, products } from invoke.input
    const product = input.products.find((p: any) => p.id === input.productId);
    if (!product) throw new Error('Product not found');
    return { item: { ...product, cartItemId: `cart-${Date.now()}` } };
  },

  removeFromCart: async (data: any, input: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { itemId: input.itemId };
  },

  processPayment: mock(
    { orderId: `ORDER-${Math.random().toString(36).substring(7).toUpperCase()}`, success: true },
    1000
  ),

  // Action plugs (immutable data updates using assign)
  storeProducts: assign((data, event) => ({
    products: event.data.products
  })),

  addItemToCart: assign((data, event) => ({
    cart: [...data.cart, event.data.item]
  })),

  removeItemFromCart: assign((data, event) => ({
    cart: data.cart.filter((item: any) => item.cartItemId !== event.data.itemId)
  })),

  storeOrderId: assign((data, event) => ({
    orderId: event.data.orderId
  })),

  logError: (data: any, event: any) => {
    console.error('❌ Error:', event.error?.message || 'Unknown error');
    return {};
  },

  // Guard plugs
  hasProductId: (data: any, event: any) => {
    return !!event.productId;
  }
};

class BlackboxCLI {
  private rl: readline.Interface;
  private session: Blackbox;
  private actions: Record<string, ActionMeta>;

  constructor(session: Blackbox, actions: Record<string, ActionMeta>) {
    // Disable terminal echo to prevent double characters
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.actions = actions;
    this.session = session;

    // Listen for events
    this.session.on('error', (error) => {
      this.printError(error.message);
    });

    this.session.on('done', () => {
      this.printSuccess('Journey completed!');
    });

    this.session.on('change', () => {
      // State changed, re-render
    });
  }

  private clear() {
    console.clear();
  }

  private printBanner() {
    console.log(`${colors.cyan}${colors.bright}`);
    console.log('┌─────────────────────────────────────────┐');
    console.log('│       🎮 BLACKBOX PROTOCOL v1.3        │');
    console.log('│      Shopping Journey Orchestrator      │');
    console.log('└─────────────────────────────────────────┘');
    console.log(colors.reset);
    console.log(`${colors.dim}Program: Pure protocol (no implementation)${colors.reset}`);
    console.log(`${colors.dim}Plugs: Runtime implementations (swappable)${colors.reset}`);
    console.log('');
  }

  private printState() {
    const state = this.session.where();
    const loading = this.session.isBusy() ? ' ⏳' : '';

    console.log(`${colors.bright}Phase:${colors.reset} ${colors.magenta}${state.phase}${loading}${colors.reset}`);
    console.log('');

    // Show relevant data based on phase
    if (state.data.products?.length > 0) {
      console.log(`${colors.bright}📦 Products Available:${colors.reset}`);
      state.data.products.forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.name} - $${p.price} ${colors.dim}(id: ${p.id})${colors.reset}`);
      });
      console.log('');
    }

    if (state.data.cart?.length > 0) {
      console.log(`${colors.bright}🛒 Cart (${state.data.cart.length} items):${colors.reset}`);
      state.data.cart.forEach((item: any, i: number) => {
        console.log(`  ${i + 1}. ${item.name} - $${item.price} ${colors.dim}(${item.cartItemId})${colors.reset}`);
      });
      const total = state.data.cart.reduce((sum: number, item: any) => sum + item.price, 0);
      console.log(`  ${colors.bright}Total: $${total}${colors.reset}`);
      console.log('');
    }

    if (state.data.orderId) {
      console.log(`${colors.green}${colors.bright}✅ Order ID: ${state.data.orderId}${colors.reset}`);
      console.log('');
    }

    if (state.error) {
      this.printError(state.error.message);
    }
  }

  private printActions() {
    const availableActions = this.session.can();

    if (availableActions.length === 0) {
      console.log(`${colors.dim}No actions available. Journey ended.${colors.reset}`);
      return;
    }

    console.log(`${colors.bright}What do you want to do?${colors.reset}`);
    console.log('');

    availableActions.forEach((action, index) => {
      const meta = this.actions[action];
      const paramsHint = meta.params ? ` ${colors.dim}(needs: ${Object.keys(meta.params).join(', ')})${colors.reset}` : '';
      console.log(`  ${colors.cyan}${index + 1}.${colors.reset} ${meta.label}${paramsHint}`);
      if (meta.description) {
        console.log(`     ${colors.dim}${meta.description}${colors.reset}`);
      }
    });

    console.log('');
  }

  private printError(message: string) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
    console.log('');
  }

  private printSuccess(message: string) {
    console.log(`${colors.green}✨ ${message}${colors.reset}`);
    console.log('');
  }

  private async promptParams(action: string): Promise<any> {
    const meta = this.actions[action];
    if (!meta.params) return {};

    const params: any = {};

    for (const [key, fieldSchema] of Object.entries(meta.params)) {
      const type = (fieldSchema as any).type || 'string';
      const input = await this.question(`  ${colors.yellow}Enter ${key} (${type}):${colors.reset} `);
      params[key] = input.trim();
    }

    return params;
  }

  private question(query: string): Promise<string> {
    return new Promise(resolve => this.rl.question(query, resolve));
  }

  private render() {
    this.clear();
    this.printBanner();
    this.printState();
    this.printActions();
  }

  async start() {
    this.render();

    // Auto-start the journey
    this.session.do('START');

    await this.loop();
  }

  private async loop(): Promise<void> {
    // Wait for loading to complete
    while (this.session.isBusy()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.render();

    const state = this.session.where();
    const availableActions = this.session.can();

    // Check if journey ended
    if (availableActions.length === 0 || state.phase === 'done' || state.phase === 'completed') {
      if (state.data.orderId) {
        console.log(`${colors.green}${colors.bright}`);
        console.log('╔═══════════════════════════════════════╗');
        console.log('║   🎉 ORDER COMPLETED SUCCESSFULLY!   ║');
        console.log(`║   Order ID: ${state.data.orderId.padEnd(23)} ║`);
        console.log('╚═══════════════════════════════════════╝');
        console.log(colors.reset);
      } else {
        this.printSuccess('Thank you for using Blackbox Protocol!');
      }
      this.rl.close();
      return;
    }

    // Get user input
    const input = await this.question(`${colors.bright}>${colors.reset} `);

    if (input.toLowerCase() === 'q' || input.toLowerCase() === 'quit') {
      this.session.do('QUIT');
      this.rl.close();
      return;
    }

    const choice = parseInt(input);
    if (isNaN(choice) || choice < 1 || choice > availableActions.length) {
      console.log(`${colors.red}Invalid choice. Please enter a number between 1 and ${availableActions.length}${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.loop();
    }

    const selectedAction = availableActions[choice - 1];
    const params = await this.promptParams(selectedAction);

    // Execute action
    this.session.do(selectedAction, params);

    // Continue loop
    await this.loop();
  }
}

// v1.3: Create blackbox from pure program, inject plugs at runtime
console.log(`${colors.cyan}${colors.bright}Initializing Blackbox Protocol v1.3...${colors.reset}`);
console.log(`${colors.dim}Loading program: shopping-journey v${shoppingProgram.version}${colors.reset}`);
console.log(`${colors.dim}Injecting runtime plugs...${colors.reset}`);
console.log('');

const blackbox = createBlackbox(shoppingProgram);
const session = blackbox.start({ userId: 'cli-user-123' });

// v1.3: Plugs injected after session creation!
session.use(plugs);

console.log(`${colors.green}✓ Session created${colors.reset}`);
console.log(`${colors.green}✓ Plugs injected${colors.reset}`);
console.log('');

// Start CLI with session
const app = new BlackboxCLI(session, shoppingProgram.actions);
app.start().catch(console.error);
