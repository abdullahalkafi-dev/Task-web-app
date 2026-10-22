// Pure rules shared by the browser, mobile and backend. No DOM/native dependencies.
const STATUS_ORDER = ["notStarted", "started", "completed"];
const STATUS_LABEL = { notStarted: "Not Started", started: "Started", completed: "Completed" };
const DHAKA_TZ = "Asia/Dhaka";
const dhakaDateKey = (value = Date.now()) => new Date(new Date(value).getTime() + 21600000).toISOString().slice(0, 10);
const nextStamp = (previous, now = Date.now()) => new Date(Math.max(now, previous ? Date.parse(previous) + 1 : 0)).toISOString();
const shouldApplyRemote = (local, remote) => !local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt);
const orderAtEnd = items => items.length ? Math.max(...items.map(item => item.orderIndex)) + 1024 : 1024;
const displayName = user => user?.name?.trim() || user?.email || "";
const toReminderInput = iso => iso ? new Date(Date.parse(iso) + 21600000).toISOString().slice(0, 16) : "";
const fromReminderInput = value => value ? new Date(`${value}:00+06:00`).toISOString() : null;
const staleSync = (lastPull, now = Date.now()) => !!lastPull && now - Date.parse(lastPull) >= 30 * 86400000;
module.exports = { STATUS_ORDER, STATUS_LABEL, DHAKA_TZ, dhakaDateKey, nextStamp, shouldApplyRemote, orderAtEnd, displayName, toReminderInput, fromReminderInput, staleSync };
