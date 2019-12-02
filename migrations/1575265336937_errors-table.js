/* eslint-disable no-undef */
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable("errors", {
    url: {
      type: "varchar(200)"
    },
    error: {
      type: "varchar(200)"
    }
  });
};

exports.down = pgm => {
  pgm.dropTable("errors");
};
