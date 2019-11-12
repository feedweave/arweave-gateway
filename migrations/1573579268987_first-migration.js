/* eslint-disable no-undef */
/* eslint-disable camelcase */

// PRIMARY KEYS
// transaction_id
// block_id
// block_height
// owner_id
// app_name

// TABLES
// user -- don't need to start
// block
// - indep_hash (string)
// - height (integer)
// - timestamp (timestamp)
// - raw_data (JSON)
// transaction
// - id (string)
// - block_hash (string)
// - raw_data (JSON)
// - owner (string)

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable("blocks", {
      hash: {
          type: 'varchar(64)',
          notNull: true,
          primaryKey: true,
          unique: true,
      },
      height: {
          type: 'integer',
          notNull: true,
          unique: true,
      },
      timestamp: {
          type: 'bigint',
          notNull: true,
      },
      rawData: {
          type: 'jsonb',
          notNull: true,

      }
  });
  pgm.createIndex('blocks', 'height');

  pgm.createTable("transactions", {
      id: {
          type: 'varchar(43)',
          notNull: true,
          primaryKey: true,
          unique: true,
      },
      blockHash: {
          type: 'varchar(64)',
          notNull: true,
          references: 'blocks',
          onDelete: 'cascade',
          unique: true,

      },
      rawData: {
          type: 'jsonb',
          notNull: true,
      },
      owner: {
          type: 'varchar(689)',
          notNull: true,
      }
  });
  pgm.createIndex('transactions', 'blockHash');
  pgm.createIndex('transactions', 'owner');
};

exports.down = pgm => {
    pgm.dropTable("transactions")
    pgm.dropTable("blocks")
};
