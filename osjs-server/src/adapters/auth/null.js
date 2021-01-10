/**
 * Null Auth adapter
 * @param {Core} core Core reference
 * @param {object} [options] Adapter options
 */
module.exports = (core, options) => ({
  init: async () => true,
  destroy: async () => true,
  register: async (req, res) => ({username: req.body.username}),
  login: async (req, res) => ({id: 0, username: req.body.username}),
  logout: async (req, res) => true
});