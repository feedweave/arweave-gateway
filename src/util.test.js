import { generateArqlQueryForAppNames } from "./util";

test("generate arql query for one app names", () => {
  const appName = "app1";
  const appNames = [appName];
  expect(generateArqlQueryForAppNames(appNames)).toEqual({
    op: "equals",
    expr1: "App-Name",
    expr2: appName
  });
});
test("generate arql query for two app names", () => {
  const app1 = "app1";
  const app2 = "app2";
  const appNames = [app1, app2];
  expect(generateArqlQueryForAppNames(appNames)).toEqual({
    op: "or",
    expr1: {
      op: "equals",
      expr1: "App-Name",
      expr2: app2
    },
    expr2: {
      op: "equals",
      expr1: "App-Name",
      expr2: app1
    }
  });
});

test("generate arql query for three app names", () => {
  const app1 = "app1";
  const app2 = "app2";
  const app3 = "app3";
  const appNames = [app1, app2, app3];
  expect(generateArqlQueryForAppNames(appNames)).toEqual({
    op: "or",
    expr1: {
      op: "equals",
      expr1: "App-Name",
      expr2: app3
    },
    expr2: {
      op: "or",
      expr1: {
        op: "equals",
        expr1: "App-Name",
        expr2: app2
      },
      expr2: {
        op: "equals",
        expr1: "App-Name",
        expr2: app1
      }
    }
  });
});

test("generate arql query for four app names", () => {
  const app1 = "app1";
  const app2 = "app2";
  const app3 = "app3";
  const app4 = "app4";
  const appNames = [app1, app2, app3, app4];
  expect(generateArqlQueryForAppNames(appNames)).toEqual({
    op: "or",
    expr1: {
      op: "equals",
      expr1: "App-Name",
      expr2: app4
    },
    expr2: {
      op: "or",
      expr1: {
        op: "equals",
        expr1: "App-Name",
        expr2: app3
      },
      expr2: {
        op: "or",
        expr1: {
          op: "equals",
          expr1: "App-Name",
          expr2: app2
        },
        expr2: {
          op: "equals",
          expr1: "App-Name",
          expr2: app1
        }
      }
    }
  });
});
