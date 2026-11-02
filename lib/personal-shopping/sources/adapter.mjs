// Common transport seam. External API adapters return observations shaped as
// { product, source }; the existing demo adapter returns its legacy demo rows.
// Consumers must explicitly map and validate either shape before use.
// `plan` supports query/queries and a bounded limit; results are never persisted.
export class ProductSourceAdapter {
  async search(_plan) { throw new Error('Not implemented'); }
  async getDetails(_id) { throw new Error('Not supported'); }
}
