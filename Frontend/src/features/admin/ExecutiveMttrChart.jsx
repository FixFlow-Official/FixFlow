import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function ExecutiveMttrChart({ data }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="department" stroke="#64748b" fontSize={12} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="h" />
          <Tooltip
            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", borderColor: "#cbd5e1" }}
            formatter={(val, name, props) => {
              const n = name === "MTTR (Hours)" ? props.payload?.resolved : props.payload?.total;
              return [val !== null && val !== undefined ? `${val}h (n=${n ?? 0})` : "No resolved complaints in this period", name];
            }}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar dataKey="mttr" name="MTTR (Hours)" fill="#0284c7" radius={[4, 4, 0, 0]} />
          <Bar dataKey="firstResponse" name="First Response (Hours)" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
