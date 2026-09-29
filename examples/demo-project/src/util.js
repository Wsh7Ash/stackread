// Secondary demo module; note left-pad is intentionally never imported anywhere
// so the demo report shows one UNUSED direct dependency.
const _ = require('lodash/fp');

function topFive(list) {
  return _.take(5, list);
}

module.exports = { topFive };
