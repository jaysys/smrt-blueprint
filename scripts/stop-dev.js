import { execFileSync } from "node:child_process";

const ports = [3001, 5173];

function getPidsForPort(port) {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (output.length === 0) {
      return [];
    }

    return output
      .split("\n")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const uniquePids = [...new Set(ports.flatMap(getPidsForPort))];

  if (uniquePids.length === 0) {
    console.log("No dev server processes found on ports 3001 or 5173.");
    return;
  }

  for (const pid of uniquePids) {
    killPid(pid, "SIGTERM");
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  for (const pid of uniquePids) {
    if (killPid(pid, 0)) {
      killPid(pid, "SIGKILL");
    }
  }

  console.log(`Stopped processes on ports ${ports.join(", ")}: ${uniquePids.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to stop dev servers.", error);
  process.exit(1);
});
