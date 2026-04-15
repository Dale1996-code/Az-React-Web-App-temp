import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { DailySummary } from "../models/summary";
import { getContainer } from "../models/cosmosClient";
import { validateSummary } from "../validation";

// Summaries collection — end-of-shift daily summaries.
export default createCrudRouter<DailySummary>(
    () => new BaseRepository<DailySummary>(getContainer("summaries")),
    "summaries",
    validateSummary,
);
