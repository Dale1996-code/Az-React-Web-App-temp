import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { getStore } from "../models/firestoreClient";
import { validateEmployee } from "../validation";

// Employees collection — stores shift roster profiles.
export default createCrudRouter<Employee>(
    () => new BaseRepository<Employee>(getStore("employees")),
    "employees",
    validateEmployee,
    (query) => {
        const conditions: FilterCondition[] = [];

        // ?active=true|false
        if (query.active !== undefined) {
            conditions.push({ op: "eq", field: "isActive", value: query.active === "true" });
        }

        // ?department=<name>  (case-insensitive exact match)
        if (query.department) {
            conditions.push({ op: "eq_ci", field: "department", value: query.department });
        }

        // ?search=<term>  (firstName, lastName, or employeeCode)
        if (query.search) {
            conditions.push({
                op: "or",
                conditions: [
                    { op: "contains_ci", field: "firstName",    value: query.search },
                    { op: "contains_ci", field: "lastName",     value: query.search },
                    { op: "contains_ci", field: "employeeCode", value: query.search },
                ],
            });
        }

        return { conditions };
    },
);
