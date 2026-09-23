import { describe, expect, it } from 'vitest'
import { jogSharedBorders } from './map-realm-borders'
import type { Point } from './map-realm-layout'

const WEST: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]
const EAST: Point[] = [
  [10, 0],
  [20, 0],
  [20, 10],
  [10, 10],
]
const everywhere = () => true

function areaOf(polygon: Point[]): number {
  let sum = 0
  polygon.forEach(([x, y], i) => {
    const [nx, ny] = polygon[(i + 1) % polygon.length]
    sum += x * ny - nx * y
  })
  return Math.abs(sum / 2)
}

describe('jogSharedBorders', () => {
  it('gives a long shared border two more corners, the same in both cells', () => {
    const [west, east] = jogSharedBorders([WEST, EAST], everywhere)
    expect(west).toHaveLength(6)
    expect(east).toHaveLength(6)
    const added = (cell: Point[]) =>
      cell.filter(([x]) => x !== 0 && x !== 10 && x !== 20)
    expect(added(west)).toHaveLength(2)
    expect(added(east).reverse()).toEqual(added(west))
    // One corner steps each way off the old line.
    const [first, second] = added(west)
    expect((first[0] - 10) * (second[0] - 10)).toBeLessThan(0)
  })

  it('takes no land from either side', () => {
    const [west, east] = jogSharedBorders([WEST, EAST], everywhere)
    expect(areaOf(west)).toBeCloseTo(100, 6)
    expect(areaOf(east)).toBeCloseTo(100, 6)
  })

  it('leaves alone a border that is short or mostly out of sight', () => {
    const small = (cell: Point[]) => cell.map(([x, y]): Point => [x / 5, y / 5])
    expect(jogSharedBorders([small(WEST), small(EAST)], everywhere)).toEqual([
      small(WEST),
      small(EAST),
    ])
    const onlyTheTop = (_: number, y: number) => y < 2
    expect(jogSharedBorders([WEST, EAST], onlyTheTop)).toEqual([WEST, EAST])
  })

  it('puts the jog in the part of the border that can be seen', () => {
    const southHalf = (_: number, y: number) => y > 5
    const [west] = jogSharedBorders(
      [
        WEST.map(([x, y]): Point => [x, y * 2]),
        EAST.map(([x, y]): Point => [x, y * 2]),
      ],
      southHalf
    )
    const added = west.filter(([x]) => x !== 0 && x !== 10)
    expect(added).toHaveLength(2)
    for (const [, y] of added) expect(y).toBeGreaterThan(5)
  })

  it('gives the same jogs every time', () => {
    expect(jogSharedBorders([WEST, EAST], everywhere)).toEqual(
      jogSharedBorders([WEST, EAST], everywhere)
    )
  })
})
