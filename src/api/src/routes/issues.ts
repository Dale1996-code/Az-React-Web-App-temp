import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { IssueLog } from "../models/issue";
import { getContainer } from "../models/cosmosClient";
import { validateIssue } from "../validation";

// Issues collection — quick-entry issue log for the shift.
export default createCrudRouter<IssueLog>(
    () => new BaseRepository<IssueLog>(getContainer("issues")),
    "issues",
    validateIssue,
    (items, query) => {
        let result = items;

        // ?date=YYYY-MM-DD (exact match on storeDate)
        if (query.date) {
            result = result.filter(i => i.storeDate === query.date);
        }

        // ?status=open|resolved
        if (query.status) {
            result = result.filter(i => i.status === query.status);
        }

        // ?department=<string> (case-insensitive)
        if (query.department) {
            const dept = query.department.toLowerCase();
            result = result.filter(i => i.department.toLowerCase() === dept);
        }

        // ?category=<string> (case-insensitive)
        if (query.category) {
            const cat = query.category.toLowerCase();
            result = result.filter(i => i.category.toLowerCase() === cat);
        }

        return result;
    },
);
