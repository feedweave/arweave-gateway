/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns("transactions", {
    createdAt: {
      type: "timestamp",
      default: pgm.func("NOW()"),
      notNull: true
    }
  });

  pgm.addColumns("blocks", {
    createdAt: {
      type: "timestamp",
      default: pgm.func("NOW()"),
      notNull: true
    }
  });

  pgm.addColumns("errors", {
    createdAt: {
      type: "timestamp",
      default: pgm.func("NOW()"),
      notNull: true
    }
  });
};

exports.down = pgm => {
  pgm.removeColumns("transactions", ["createdAt"]);
  pgm.removeColumns("blocks", ["createdAt"]);
  pgm.removeColumns("errors", ["createdAt"]);
};
