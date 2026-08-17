import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { colorFor, percentFor, shortDay } from "./energy";
import { useCurrentTheme } from "./theme";

// The energy chart: one bar per day, coloured by band.
//
// Days nobody wrote are drawn as a gap rather than a zero or a joined line. A
// line would say the days in between were somewhere on the way from one to the
// other, which is a claim about days that have no rating at all.
//
// Over 30 days the numbers come off: thirty labels on a phone are a grey smear,
// and at that range what you're reading is the run of colour anyway.
export default function EnergyChart({ entries, days }) {
  // Before the early return: a hook has to run on every render, not only the
  // ones that reach the chart.
  const theme = useCurrentTheme();
  const data = entries.map((e) => ({
    day: shortDay(e.date),
    percent: percentFor(e.energy),
    score: e.energy,
  }));

  const rated = data.filter((d) => d.percent);
  if (!rated.length) {
    return <p className="hint">Rate a day and it begins to show here.</p>;
  }

  const dense = days > 7;
  const average = Math.round(
    rated.reduce((sum, d) => sum + d.percent, 0) / rated.length,
  );

  return (
    <div className="chart">
      <div className="chartlede">
        <span className="figure" style={{ color: colorFor(average / 10, theme) }}>
          {average}%
        </span>
        <span className="caption">average over {rated.length} rated days</span>
      </div>

      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={data} margin={{ top: 20, right: 2, bottom: 0, left: 2 }}>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            interval={dense ? "preserveStartEnd" : 0}
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5, letterSpacing: "0.04em" }}
            dy={4}
          />
          <Bar
            dataKey="percent"
            radius={[6, 6, 6, 6]}
            maxBarSize={dense ? 8 : 26}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.score, theme)} />
            ))}
            {!dense && (
              <LabelList
                dataKey="percent"
                position="top"
                formatter={(v) => (v ? `${v}` : "")}
                style={{ fontSize: 11, fill: "currentColor", opacity: 0.55, letterSpacing: "0.03em" }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
