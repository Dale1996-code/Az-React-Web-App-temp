import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { Task } from "../models/task";
import { getContainer } from "../models/cosmosClient";
import { validateTask } from "../validation";

// Tasks collection — daily tasks tracked during a shift.
export default createCrudRouter<Task>(
    () => new BaseRepository<Task>(getContainer("tasks")),
    "tasks",
    validateTask,
    (items, query) => {
        let result = items;

        // ?status=notStarted|inProgress|completed
        if (query.status) {
            result = result.filter(t => t.status === query.status);
        }

        // ?date=YYYY-MM-DD  (exact match on storeDate)
        if (query.date) {
            result = result.filter(t => t.storeDate === query.date);
        }

        // ?department=<name>  (case-insensitive exact match)
        if (query.department) {
            const dept = query.department.toLowerCase();
            result = result.filter(t => t.department.toLowerCase() === dept);
        }

        return result;
    },
);
