import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { YouDotCom } from '../nodes/YouDotCom/YouDotCom.node.ts'

/**
 * Cross-checks every example workflow under examples/ against the node's own
 * parameter schema. n8n "collection"-type fields group optional sub-fields
 * for the UI, but the workflow JSON must nest those sub-fields under the
 * collection's name — setting them at the top level of "parameters" is
 * silently ignored at execution time. This test exists because that exact
 * mistake shipped in this PR's first draft for three of the five examples.
 */

interface NodeProperty {
  name: string
  type: string
  displayOptions?: { show?: { operation?: string[] } }
  options?: unknown
}

const EXAMPLES_DIR = join(import.meta.dir, '..', 'examples')
const properties = new YouDotCom().description.properties as NodeProperty[]
const packageJson = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')) as { name: string }

const operationProperty = properties.find((p) => p.name === 'operation') as unknown as {
  options: Array<{ value: string }>
}
const validOperations = new Set(operationProperty.options.map((o) => o.value))

function isVisibleForOperation(prop: NodeProperty, operation: string): boolean {
  const ops = prop.displayOptions?.show?.operation
  return !ops || ops.includes(operation)
}

/** All sub-field names nested (at any depth) inside a "collection" property. */
function collectNestedNames(prop: NodeProperty, into: Set<string>): void {
  if (prop.type !== 'collection' || !Array.isArray(prop.options)) return
  for (const sub of prop.options as NodeProperty[]) {
    if (sub && typeof sub === 'object' && typeof sub.name === 'string') {
      into.add(sub.name)
      collectNestedNames(sub, into)
    }
  }
}

function checkNodeParameters(operation: string, parameters: Record<string, unknown>): string[] {
  const errors: string[] = []
  if (!validOperations.has(operation)) {
    errors.push(`unknown operation "${operation}"`)
    return errors
  }

  const visible = properties.filter((p) => isVisibleForOperation(p, operation))
  const topLevelNames = new Set(visible.map((p) => p.name))
  const nestedNames = new Set<string>()
  for (const prop of visible) collectNestedNames(prop, nestedNames)

  for (const key of Object.keys(parameters)) {
    if (key === 'operation' || topLevelNames.has(key)) continue
    if (nestedNames.has(key)) {
      errors.push(`"${key}" belongs inside a collection field for operation "${operation}", not at the top level`)
    } else {
      errors.push(`"${key}" is not a valid parameter for operation "${operation}"`)
    }
  }
  return errors
}

const youDotComType = `${packageJson.name}.${new YouDotCom().description.name}`
const exampleFiles = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json'))

describe('Example workflows match the node parameter schema', () => {
  test('at least one example file exists', () => {
    expect(exampleFiles.length).toBeGreaterThan(0)
  })

  for (const file of exampleFiles) {
    test(file, () => {
      const workflow = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), 'utf8')) as {
        nodes: Array<{ type: string; parameters: Record<string, unknown> }>
      }
      const youDotComNodes = workflow.nodes.filter((n) => n.type === youDotComType)
      expect(youDotComNodes.length).toBeGreaterThan(0)

      for (const node of youDotComNodes) {
        const operation = node.parameters.operation as string
        const errors = checkNodeParameters(operation, node.parameters)
        expect(errors).toEqual([])
      }
    })
  }
})
