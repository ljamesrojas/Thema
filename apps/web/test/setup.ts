// Shared test setup. Testing Library's waits (waitFor, findBy…) give up after 1 s by default; a
// full `pnpm test` runs every package at once, and on a busy machine a few account and Workspace
// steps needed longer. 5 s still fails fast on a real bug.
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 5000 });
