import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { getContainer } from "../models/cosmosClient";
import { validateEmployee } from "../validation";

// Employees collection — stores shift roster profiles.
export default createCrudRouter<Employee>(
    () => new BaseRepository<Employee>(getContainer("employees")),
    "employees",
    validateEmployee,
    (items, query) => {
        let result = items;

        // ?active=true|false
        if (query.active !== undefined) {
            const active = query.active === "true";
            result = result.filter(e => e.isActive === active);
        }

        // ?department=<name>  (case-insensitive exact match)
        if (query.department) {
            const dept = query.department.toLowerCase();
            result = result.filter(e => e.department?.toLowerCase() === dept);
        }

        // ?search=<term>  (firstName, lastName, or employeeCode)
        if (query.search) {
            const term = query.search.toLowerCase();
            result = result.filter(
                e =>
                    e.firstName.toLowerCase().includes(term) ||
                    e.lastName.toLowerCase().includes(term) ||
                    (e.employeeCode?.toLowerCase().includes(term) ?? false),
            );
        }

        return result;
    },
);
