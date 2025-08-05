import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Group,
  Text,
  vec,
  type SkPoint,
  Points,
  Matrix4,
} from "@shopify/react-native-skia";
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { getOffsetFromAngle } from "../../utils/getOffsetFromAngle";
import { DEFAULT_TICK_COUNT, downsampleTicks } from "../../utils/tickHelpers";
import type {
  InputDatum,
  InputFields,
  ValueOf,
  XAxisProps,
  XAxisPropsWithDefaults,
} from "../../types";

export const XAxis = <
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
>({
  xScale: xScaleProp,
  yScale,
  tickCount = DEFAULT_TICK_COUNT,
  tickValues,
  font,
  enableRescaling,
  zoom,
  matrix,
  ...restProps
}: XAxisProps<RawData, XK> & { matrix: SharedValue<Matrix4> | undefined }) => {
  const xScale = zoom ? zoom.rescaleX(xScaleProp) : xScaleProp;
  const [y1 = 0, y2 = 0] = yScale.domain();
  const fontSize = font?.getSize() ?? 0;
  const xTicksNormalized = tickValues
    ? downsampleTicks(tickValues, tickCount)
    : enableRescaling
      ? xScale.ticks(tickCount)
      : xScaleProp.ticks(tickCount);

  const xAxisNodes = useMemo(
    () =>
      xTicksNormalized.map((tick) => {
        return (
          <XAxle
            {...restProps}
            font={font}
            tick={tick}
            xScale={xScale}
            yScale={yScale}
            y1={y1}
            y2={y2}
            fontSize={fontSize}
            key={`x-tick-${tick}`}
            matrix={matrix}
          />
        );
      }),
    [xTicksNormalized, fontSize, y1, y2],
  );

  return xAxisNodes;
};

function XAxle<
  RawData extends Record<string, unknown>,
  XK extends keyof InputFields<RawData>,
>({
  xScale,
  yScale,
  tick,
  y1,
  y2,
  matrix,
  axisSide = "bottom",
  yAxisSide = "left",
  labelPosition = "outset",
  labelRotate,
  labelOffset = 2,
  labelColor = "#000000",
  lineWidth = StyleSheet.hairlineWidth,
  lineColor = "hsla(0, 0%, 0%, 0.25)",
  font,
  formatXLabel = (label: ValueOf<InputDatum>) => String(label),
  ix = [],
  isNumericalData,
  linePathEffect,
  chartBounds,
  fontSize,
}: Omit<XAxisProps<RawData, XK>, "tickCount"> & {
  tick: number;
  y1: number;
  y2: number;
  fontSize: number;
  matrix: SharedValue<Matrix4> | undefined;
}) {
  const val = isNumericalData ? tick : ix[tick];

  const contentX = formatXLabel(val as never);
  const labelWidth =
    font
      ?.getGlyphWidths?.(font.getGlyphIDs(contentX))
      .reduce((sum, value) => sum + value, 0) ?? 0;
  const labelX = xScale(tick) - (labelWidth ?? 0) / 2;
  const canFitLabelContent =
    xScale(tick) >= chartBounds.left &&
    xScale(tick) <= chartBounds.right &&
    (yAxisSide === "left"
      ? labelX + labelWidth < chartBounds.right
      : chartBounds.left < labelX);

  const labelY = (() => {
    // bottom, outset
    if (axisSide === "bottom" && labelPosition === "outset") {
      return chartBounds.bottom + labelOffset + fontSize;
    }
    // bottom, inset
    if (axisSide === "bottom" && labelPosition === "inset") {
      return yScale(y2) - labelOffset;
    }
    // top, outset
    if (axisSide === "top" && labelPosition === "outset") {
      return yScale(y1) - labelOffset;
    }
    // top, inset
    return yScale(y1) + fontSize + labelOffset;
  })();

  // Calculate origin and translate for label rotation
  const { origin, rotateOffset } = ((): {
    origin: SkPoint | undefined;
    rotateOffset: number;
  } => {
    let rotateOffset = 0;
    let origin;

    // return defaults if no labelRotate is provided
    if (!labelRotate) return { origin, rotateOffset };

    if (axisSide === "bottom" && labelPosition === "outset") {
      // bottom, outset
      origin = vec(labelX + labelWidth / 2, labelY);
      rotateOffset = Math.abs(
        (labelWidth / 2) * getOffsetFromAngle(labelRotate),
      );
    } else if (axisSide === "bottom" && labelPosition === "inset") {
      // bottom, inset
      origin = vec(labelX + labelWidth / 2, labelY);
      rotateOffset = -Math.abs(
        (labelWidth / 2) * getOffsetFromAngle(labelRotate),
      );
    } else if (axisSide === "top" && labelPosition === "inset") {
      // top, inset
      origin = vec(labelX + labelWidth / 2, labelY - fontSize / 4);
      rotateOffset = Math.abs(
        (labelWidth / 2) * getOffsetFromAngle(labelRotate),
      );
    } else {
      // top, outset
      origin = vec(labelX + labelWidth / 2, labelY - fontSize / 4);
      rotateOffset = -Math.abs(
        (labelWidth / 2) * getOffsetFromAngle(labelRotate),
      );
    }

    return { origin, rotateOffset };
  })();

  // const x = useSharedValue(0);
  // const scaledY1 = yScale(y1);
  // const scaledY2 = yScale(y2);

  const p1 = useMemo(() => vec(xScale(tick), yScale(y2)), [tick]);
  const p2 = useMemo(() => vec(xScale(tick), yScale(y1)), [tick]);

  console.log(p1.x);

  // const animatedLine = useDerivedValue(() => {
  //   const startPoint = vec(x.value, scaledY2);
  //   const endPoint = vec(x.value, scaledY1);

  //   return [startPoint, endPoint];
  // });

  return (
    <React.Fragment>
      {lineWidth > 0 ? (
        <Group matrix={matrix}>
          <Points
            points={[p1, p2]}
            color={lineColor}
            mode="polygon"
            style="stroke"
            strokeWidth={lineWidth}
          >
            {linePathEffect ? linePathEffect : null}
          </Points>
        </Group>
      ) : null}
      {font && labelWidth && canFitLabelContent ? (
        <Group transform={[{ translateY: rotateOffset }]} matrix={matrix}>
          <Text
            transform={[
              {
                rotate: (Math.PI / 180) * (labelRotate ?? 0),
              },
            ]}
            origin={origin}
            color={labelColor}
            text={contentX}
            font={font}
            y={labelY}
            x={labelX}
          />
        </Group>
      ) : null}
      <></>
    </React.Fragment>
  );
}

export const XAxisDefaults = {
  lineColor: "hsla(0, 0%, 0%, 0.25)",
  lineWidth: StyleSheet.hairlineWidth,
  tickCount: 5,
  labelOffset: 2,
  axisSide: "bottom",
  yAxisSide: "left",
  labelPosition: "outset",
  formatXLabel: (label: ValueOf<InputDatum>) => String(label),
  labelColor: "#000000",
  labelRotate: 0,
} satisfies XAxisPropsWithDefaults<never, never>;
