import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Role = "viewer" | "analyst" | "admin";

type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: number;
};

type FinancialRecord = {
  id: number;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  notes: string;
  createdByName?: string;
};

type Overview = {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalRecords: number;
};

type CategoryTotal = {
  category: string;
  type: "income" | "expense";
  total: number;
};

type Trend = {
  bucket: string;
  income: number;
  expense: number;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const permissions: Record<Role, string[]> = {
  viewer: ["users:read", "records:read", "summary:read"],
  analyst: ["users:read", "records:read", "records:create", "records:update", "summary:read"],
  admin: [
    "users:read",
    "users:create",
    "users:update",
    "records:read",
    "records:create",
    "records:update",
    "records:delete",
    "summary:read"
  ]
};

function can(role: Role | undefined, permission: string): boolean {
  if (!role) {
    return false;
  }

  return permissions[role].includes(permission);
}

async function apiRequest<T>(
  path: string,
  actorId: number,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": String(actorId)
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

const defaultRecordForm = {
  amount: 0,
  type: "expense" as "income" | "expense",
  category: "",
  date: new Date().toISOString().slice(0, 10),
  notes: ""
};

function App() {
  const [actorId, setActorId] = useState<number>(1);
  const [users, setUsers] = useState<User[]>([]);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [recent, setRecent] = useState<FinancialRecord[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recordForm, setRecordForm] = useState(defaultRecordForm);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "viewer" as Role });
  const [filters, setFilters] = useState({ type: "", category: "", startDate: "", endDate: "" });

  const activeUser = useMemo(() => users.find((u) => u.id === actorId), [users, actorId]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const [usersRes, recordsRes, overviewRes, categoryRes, trendsRes, recentRes] = await Promise.all([
        apiRequest<{ data: User[] }>("/api/users", actorId),
        apiRequest<{ data: FinancialRecord[] }>(
          `/api/records?page=1&pageSize=10${filters.type ? `&type=${filters.type}` : ""}${filters.category ? `&category=${filters.category}` : ""}${filters.startDate ? `&startDate=${filters.startDate}` : ""}${filters.endDate ? `&endDate=${filters.endDate}` : ""}`,
          actorId
        ),
        apiRequest<{ data: Overview }>("/api/summary/overview", actorId),
        apiRequest<{ data: CategoryTotal[] }>("/api/summary/category-totals", actorId),
        apiRequest<{ data: Trend[] }>("/api/summary/trends?period=monthly", actorId),
        apiRequest<{ data: FinancialRecord[] }>("/api/summary/recent-activity?limit=5", actorId)
      ]);

      setUsers(usersRes.data);
      setRecords(recordsRes.data);
      setOverview(overviewRes.data);
      setCategoryTotals(categoryRes.data);
      setTrends(trendsRes.data);
      setRecent(recentRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [actorId]);

  async function saveRecord(e: FormEvent): Promise<void> {
    e.preventDefault();

    try {
      if (editingId) {
        await apiRequest(`/api/records/${editingId}`, actorId, "PUT", recordForm);
      } else {
        await apiRequest("/api/records", actorId, "POST", recordForm);
      }

      setRecordForm(defaultRecordForm);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record");
    }
  }

  async function removeRecord(id: number): Promise<void> {
    try {
      await apiRequest(`/api/records/${id}`, actorId, "DELETE");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    }
  }

  async function createUser(e: FormEvent): Promise<void> {
    e.preventDefault();

    try {
      await apiRequest("/api/users", actorId, "POST", {
        ...newUserForm,
        isActive: true
      });
      setNewUserForm({ name: "", email: "", role: "viewer" });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function toggleUserStatus(user: User): Promise<void> {
    try {
      await apiRequest(`/api/users/${user.id}/status`, actorId, "PATCH", {
        isActive: !Boolean(user.isActive)
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    }
  }

  async function rotateRole(user: User): Promise<void> {
    const order: Role[] = ["viewer", "analyst", "admin"];
    const currentIndex = order.indexOf(user.role);
    const nextRole = order[(currentIndex + 1) % order.length];

    try {
      await apiRequest(`/api/users/${user.id}/role`, actorId, "PATCH", { role: nextRole });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role");
    }
  }

  const role = activeUser?.role;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-col gap-4 card p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg lg:text-2xl font-semibold uppercase tracking-[0.15em] text-cyan-700">Finance Dashboard Assignment</p>
          <p className="mt-1 text-sm text-slate-600">Role-based access, financial records, and summary analytics.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">Acting user</label>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            aria-label="Acting user"
            value={actorId}
            onChange={(e) => setActorId(Number(e.target.value))}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => void loadAll()}
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Income</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">${overview?.totalIncome.toFixed(2) ?? "0.00"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Expense</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">${overview?.totalExpense.toFixed(2) ?? "0.00"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net Balance</p>
          <p className="mt-2 text-2xl font-bold text-sky-700">${overview?.netBalance.toFixed(2) ?? "0.00"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Records</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{overview?.totalRecords ?? 0}</p>
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <article className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Financial Records</h2>
            {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-5">
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
              aria-label="Filter by type"
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
              aria-label="Filter by category"
              placeholder="Category"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
              aria-label="Filter start date"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
              aria-label="Filter end date"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => void loadAll()}>
              Apply
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>
                      <span className={`badge ${record.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {record.type}
                      </span>
                    </td>
                    <td>{record.category}</td>
                    <td>${record.amount.toFixed(2)}</td>
                    <td>{record.notes || "-"}</td>
                    <td>{record.createdByName ?? "-"}</td>
                    <td className="space-x-2">
                      {can(role, "records:update") ? (
                        <button
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                          onClick={() => {
                            setEditingId(record.id);
                            setRecordForm({
                              amount: record.amount,
                              type: record.type,
                              category: record.category,
                              date: record.date,
                              notes: record.notes ?? ""
                            });
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {can(role, "records:delete") ? (
                        <button
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700"
                          onClick={() => void removeRecord(record.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card p-4">
          <h2 className="mb-3 text-xl font-bold text-slate-900">{editingId ? "Update Record" : "Create Record"}</h2>
          {can(role, editingId ? "records:update" : "records:create") ? (
            <form className="space-y-3" onSubmit={(e) => void saveRecord(e)}>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="Record amount"
                type="number"
                min={0}
                step="0.01"
                value={recordForm.amount}
                onChange={(e) => setRecordForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                required
              />
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="Record type"
                value={recordForm.type}
                onChange={(e) =>
                  setRecordForm((prev) => ({
                    ...prev,
                    type: e.target.value as "income" | "expense"
                  }))
                }
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="Record category"
                placeholder="Category"
                value={recordForm.category}
                onChange={(e) => setRecordForm((prev) => ({ ...prev, category: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="Record date"
                type="date"
                value={recordForm.date}
                onChange={(e) => setRecordForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                rows={3}
                placeholder="Notes"
                value={recordForm.notes}
                onChange={(e) => setRecordForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">
                {editingId ? "Update" : "Create"}
              </button>
              {editingId ? (
                <button
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setRecordForm(defaultRecordForm);
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-slate-500">Current role does not have write access for records.</p>
          )}
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <article className="card p-4">
          <h3 className="mb-2 text-lg font-bold text-slate-900">Category Totals</h3>
          <ul className="space-y-2 text-sm">
            {categoryTotals.map((item) => (
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2" key={`${item.category}-${item.type}`}>
                <span>
                  {item.category} <span className="text-slate-500">({item.type})</span>
                </span>
                <strong>${Number(item.total).toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="card p-4 lg:col-span-2">
          <h3 className="mb-2 text-lg font-bold text-slate-900">Monthly Trends</h3>
          <div className="overflow-x-auto">
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Income</th>
                  <th>Expense</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend) => (
                  <tr key={trend.bucket}>
                    <td>{trend.bucket}</td>
                    <td>${Number(trend.income).toFixed(2)}</td>
                    <td>${Number(trend.expense).toFixed(2)}</td>
                    <td>${(Number(trend.income) - Number(trend.expense)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <article className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">User Management</h3>
            {role ? <span className="badge bg-sky-100 text-sky-700">{role}</span> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.isActive ? "active" : "inactive"}</td>
                    <td className="space-x-2">
                      {can(role, "users:update") ? (
                        <>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            onClick={() => void rotateRole(user)}
                          >
                            Rotate Role
                          </button>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            onClick={() => void toggleUserStatus(user)}
                          >
                            Toggle Status
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card p-4">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Create User</h3>
          {can(role, "users:create") ? (
            <form className="space-y-3" onSubmit={(e) => void createUser(e)}>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="User full name"
                placeholder="Full name"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="User email"
                placeholder="Email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                aria-label="User role"
                value={newUserForm.role}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value as Role }))}
              >
                <option value="viewer">Viewer</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
              <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create User
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Only admin can create users.</p>
          )}
        </article>
      </section>

      <section className="card p-4">
        <h3 className="mb-2 text-lg font-bold text-slate-900">Recent Activity</h3>
        <ul className="space-y-2 text-sm">
          {recent.map((item) => (
            <li className="rounded-lg border border-slate-200 px-3 py-2" key={item.id}>
              <strong>{item.date}</strong> | {item.type} | {item.category} | ${item.amount.toFixed(2)} | {item.createdByName}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
