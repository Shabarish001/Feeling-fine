import { demoCatalog } from '../demo-catalog.mjs';
import { ProductSourceAdapter } from './adapter.mjs';
export class DemoAdapter extends ProductSourceAdapter {
  async search(plan) { return demoCatalog.filter(p => p.category === plan.category); }
  async getDetails(id) { return demoCatalog.find(p => p.id === id) || null; }
}
