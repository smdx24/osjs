/**
 * Null Settings adapter
 * @param {Core} core Core reference
 * @param {object} [options] Adapter options
 */
module.exports = (core, options) => ({
  init: async () => true,
  destroy: async () => true,
  save: async () => true,
  load: async () => ({})
});