/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    UPDATE transactions f
    SET "createdAt" = to_timestamp(ts::int)
    FROM (
      SELECT id, blocks."rawData"->>'timestamp' AS ts FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash
    ) s
    WHERE f.id = s.id AND f."blockHash" IS NOT NULL;
  `);
  pgm.sql(`ALTER TABLE transactions ADD COLUMN "seqID" INT;`);
  pgm.sql(`
    UPDATE transactions f
    SET "seqID" = rn
    FROM (
      SELECT id, row_number() OVER (ORDER BY "createdAt") AS rn FROM transactions
    ) s
    WHERE f.id = s.id;
    CREATE SEQUENCE seq_id AS INTEGER START 1 OWNED BY transactions."seqID";
    SELECT setval('seq_id',  (SELECT MAX("seqID")+1 FROM transactions));
    ALTER TABLE "transactions" ALTER COLUMN "seqID" SET DEFAULT nextval('seq_id');
  `);
  pgm.createIndex("transactions", "seqID");
};

exports.down = pgm => {
  pgm.dropColumns("transactions", ["seqID"]);
};
