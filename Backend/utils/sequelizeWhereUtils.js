const { Op } = require('sequelize');

/**
 * AND an OR-group onto a Sequelize where clause without replacing an existing Op.or.
 * @param {object} where
 * @param {object[]} orGroup
 * @returns {object}
 */
const appendWhereOrGroup = (where = {}, orGroup) => {
  if (!Array.isArray(orGroup) || orGroup.length === 0) return where;

  const next = { ...where };
  const orClause = { [Op.or]: orGroup };

  if (next[Op.or]) {
    const existingOr = next[Op.or];
    delete next[Op.or];
    const andParts = Array.isArray(next[Op.and])
      ? [...next[Op.and]]
      : next[Op.and]
        ? [next[Op.and]]
        : [];
    andParts.push({ [Op.or]: existingOr });
    andParts.push(orClause);
    next[Op.and] = andParts;
    return next;
  }

  if (next[Op.and]) {
    next[Op.and] = Array.isArray(next[Op.and])
      ? [...next[Op.and], orClause]
      : [next[Op.and], orClause];
    return next;
  }

  next[Op.or] = orGroup;
  return next;
};

module.exports = {
  appendWhereOrGroup,
};
