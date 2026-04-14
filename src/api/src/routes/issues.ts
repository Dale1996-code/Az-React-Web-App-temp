import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { IssueLog } from "../models/issue";
import { getContainer } from "../models/cosmosClient";

// Issues collection — quick-entry issue log for the shift.
export default createCrudRouter<IssueLog>(
    () => new BaseRepository<IssueLog>(getContainer("issues")),
    "issues",
);
