import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository, FilterCondition } from "../models/baseRepository";
import { Task } from "../models/task";
import { getStore } from "../models/firestoreClient";
import { validateTask } from "../validation";

// Tasks collection — daily tasks tracked during a shift.
export default createCrudRouter<Task>(
    () => new BaseRepository<Task>(getStore("tasks")),
    "tasks",
    validateTask,
    (query) => {
        const conditions: FilterCondition[] = [];

        // ?status=notStarted|inProgress|completed
        if (query.status) {
            conditions.push({ op: "eq", field: "status", value: query.status });
        }

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            conditions.push({ op: "eq", field: "storeDate", value: query.date });
        }

        // ?department=<name>  (case-insensitive exact match)
        if (query.department) {
            conditions.push({ op: "eq_ci", field: "department", value: query.department });
        }

        return { conditions };
    },
);
