import { useMemo } from "react";

const FIREWORK_COLORS = {
  yellow: "hsl(50, 100%, 70%)",
  green: "hsl(130, 90%, 70%)",
  cyan: "hsl(190, 80%, 70%)",
  blue: "hsl(240, 50%, 50%)",
  purple: "hsl(260, 50%, 55%)",
  lightPurple: "hsl(260, 80%, 75%)",
  pink: "hsl(330, 100%, 75%)",
};

const DURATION = 1200;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pathWave(x1, y1, x2, y2, segments, amplitude) {
  const points = [];
  const maxFactor = 0.5;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x = x1 + (x2 - x1) * t;
    let y = y1 + (y2 - y1) * t;

    if (i > 0 && i < segments) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const offset = randomBetween(-maxFactor, maxFactor) * amplitude;
      x += Math.cos(angle + Math.PI / 2) * offset;
      y += Math.sin(angle + Math.PI / 2) * offset;
    }
    points.push({ x, y });
  }

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
  }
  d += ` L ${x2},${y2}`;

  return d;
}

function Firework({ x, y, children }) {
  return <g transform={`translate(${x}, ${y})`}>{children}</g>;
}

function FireworkRing({
  radius,
  type = "dashed",
  delay = 0,
  fillColor = "none",
  strokeColor,
  strokeWidth = 1,
  direction,
}) {
  const delayStyle = { animationDelay: `${delay}ms` };

  if (type.includes("dots")) {
    const dots = Number(type.slice(0, -4));
    const ringClass = `fireworks__ring fireworks__ring--${direction}`;
    const dotArray = [];

    for (let d = 1; d <= dots; d++) {
      const dotTransform = `rotate(${(360 / dots) * d}) translate(0, ${radius})`;
      dotArray.push(
        <g key={d} transform={dotTransform}>
          <circle
            className="fireworks__particle fireworks__particle--dot"
            fill={fillColor}
            stroke={strokeColor}
            r={strokeWidth}
            style={delayStyle}
          />
        </g>,
      );
    }

    return (
      <g className={ringClass} style={delayStyle}>
        {dotArray}
      </g>
    );
  }

  if (type.includes("rays")) {
    const isQuick = type.includes("Quick");
    const rays = Number(type.slice(0, isQuick ? -9 : -4));
    const rayStrokeWidth = fillColor === "none" ? 2 : 0;
    const rx = strokeWidth / 10;
    const rayClass = `fireworks__particle ${
      isQuick ? "fireworks__particle--quick-ray" : "fireworks__particle--ray"
    }`;
    const quickRayClass = `fireworks__particle ${
      isQuick ? "fireworks__particle--quick-ray-flip" : "fireworks__particle--ray-flip"
    }`;
    const rayArray = [];

    for (let r = 1; r <= rays; r++) {
      const rayTranslateY = radius - strokeWidth;
      const rayTransform = `rotate(${(360 / rays) * r}) translate(0, ${rayTranslateY})`;
      const rayFlipTransform = `rotate(180) translate(0, ${-strokeWidth * 2})`;

      rayArray.push(
        <g key={r} transform={rayTransform}>
          <ellipse
            className={rayClass}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={rayStrokeWidth}
            cy={strokeWidth}
            rx={rx}
            ry={strokeWidth}
            style={delayStyle}
          />
          <g transform={rayFlipTransform}>
            <ellipse
              className={quickRayClass}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={rayStrokeWidth}
              cy={strokeWidth}
              rx={rx}
              ry={strokeWidth}
              style={delayStyle}
            />
          </g>
        </g>,
      );
    }

    return <g>{rayArray}</g>;
  }

  const directionClass = `fireworks__ring fireworks__ring--${direction}`;

  return (
    <g className={directionClass} style={delayStyle}>
      <circle
        className="fireworks__particle fireworks__particle--dashed"
        fill={fillColor}
        pathLength="48"
        stroke={strokeColor}
        strokeDasharray="1 2"
        strokeWidth={radius}
        r={radius / 2}
        style={delayStyle}
      />
    </g>
  );
}

function FireworkRocket({ y, delay = 0, exhaustColor = "#000", exhaustLength = 1 }) {
  const trajectoryStart = 600;
  const trajectoryWidth = 4;
  const trajectory = trajectoryStart - y - trajectoryWidth;
  const unfilled = trajectory - exhaustLength;
  const delayStyle = { animationDelay: `${delay}ms` };
  // Memoized so the jittered path stays stable across parent re-renders.
  const d = useMemo(() => pathWave(0, 0, 0, trajectory, 20, 15), [trajectory]);

  return (
    <path
      className="fireworks__rocket"
      fill="none"
      stroke={exhaustColor}
      strokeLinecap="round"
      strokeWidth={trajectoryWidth}
      d={d}
      strokeDasharray={`${exhaustLength} ${unfilled + trajectory}`}
      strokeDashoffset={-trajectory}
      style={delayStyle}
    />
  );
}

export default function Fireworks({ className = "" }) {
  const c = FIREWORK_COLORS;

  return (
    <svg
      className={`fireworks ${className}`}
      viewBox="0 0 800 600"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ "--anim-dur": `${DURATION}ms` }}
    >
      <Firework x={336} y={284}>
        <FireworkRocket y={284} delay={-0.675 * DURATION} exhaustColor={c.purple} exhaustLength={150} />
        <FireworkRing delay={-0.675 * DURATION} type="32dots" radius={220} fillColor={c.yellow} strokeWidth={24} direction="cw" />
        <FireworkRing delay={-0.675 * DURATION} type="24dots" radius={170} fillColor={c.green} strokeWidth={15} direction="ccw" />
        <FireworkRing delay={-0.675 * DURATION} type="dashed" radius={60} strokeColor={c.lightPurple} direction="ccw" />
      </Firework>

      <Firework x={346} y={326}>
        <FireworkRocket delay={-0.475 * DURATION} y={326} exhaustColor={c.purple} exhaustLength={200} />
        <FireworkRing delay={-0.475 * DURATION} type="16dots" radius={100} fillColor={c.green} strokeWidth={30} direction="ccw" />
        <FireworkRing delay={-0.475 * DURATION} type="dashed" radius={60} strokeColor={c.lightPurple} direction="ccw" />
      </Firework>

      <Firework x={413} y={316}>
        <FireworkRocket delay={-0.975 * DURATION} y={316} exhaustColor={c.purple} exhaustLength={240} />
        <FireworkRing delay={-0.975 * DURATION} type="16dots" radius={168} fillColor={c.yellow} strokeWidth={30} direction="ccw" />
        <FireworkRing delay={-0.975 * DURATION} type="16dots" radius={96} fillColor={c.pink} strokeWidth={30} direction="ccw" />
        <FireworkRing delay={-0.975 * DURATION} type="dashed" radius={56} strokeColor={c.cyan} direction="ccw" />
      </Firework>

      <Firework x={512} y={348}>
        <FireworkRocket delay={-0.725 * DURATION} y={348} exhaustColor={c.purple} exhaustLength={190} />
        <FireworkRing delay={-0.725 * DURATION} type="16dots" radius={100} fillColor={c.green} strokeWidth={10} direction="ccw" />
        <FireworkRing delay={-0.725 * DURATION} type="dashed" radius={38} strokeColor={c.lightPurple} direction="ccw" />
      </Firework>

      <Firework x={552} y={422}>
        <FireworkRocket delay={-0.6 * DURATION} y={422} exhaustColor={c.purple} exhaustLength={170} />
        <FireworkRing delay={-0.6 * DURATION} type="32dots" radius={170} fillColor={c.lightPurple} strokeWidth={30} direction="cw" />
        <FireworkRing delay={-0.6 * DURATION} type="20dots" radius={130} fillColor={c.cyan} strokeWidth={24} direction="ccw" />
        <FireworkRing delay={-0.6 * DURATION} type="8raysQuick" radius={60} strokeColor={c.pink} strokeWidth={25} />
      </Firework>

      <Firework x={173} y={338}>
        <FireworkRing delay={-0.45 * DURATION} type="16rays" radius={50} fillColor={c.blue} strokeWidth={15} />
      </Firework>

      <Firework x={222} y={160}>
        <FireworkRing delay={-0.375 * DURATION} type="8rays" radius={60} fillColor={c.yellow} strokeWidth={20} />
      </Firework>

      <Firework x={242} y={260}>
        <FireworkRing delay={-0.675 * DURATION} type="8rays" radius={50} fillColor={c.yellow} strokeWidth={25} />
      </Firework>

      <Firework x={278} y={438}>
        <FireworkRing delay={-0.475 * DURATION} type="8rays" radius={60} fillColor={c.yellow} strokeWidth={22} />
      </Firework>

      <Firework x={410} y={316}>
        <FireworkRing delay={-0.85 * DURATION} type="8rays" radius={192} fillColor={c.lightPurple} strokeWidth={70} />
      </Firework>

      <Firework x={478} y={230}>
        <FireworkRing delay={-0.4 * DURATION} type="16rays" radius={60} fillColor={c.blue} strokeWidth={22} />
      </Firework>

      <Firework x={542} y={182}>
        <FireworkRing delay={-0.55 * DURATION} type="8rays" radius={60} fillColor={c.yellow} strokeWidth={20} />
      </Firework>

      <Firework x={652} y={380}>
        <FireworkRing delay={-0.4 * DURATION} type="16rays" radius={36} fillColor={c.blue} strokeWidth={13} />
      </Firework>
    </svg>
  );
}
