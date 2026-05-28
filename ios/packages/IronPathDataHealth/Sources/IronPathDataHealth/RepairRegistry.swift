// RepairRegistry — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Swift port of `src/dataHealth/appDataRepairEngine.ts:buildRegistry`
// + the V1_REPAIRS list in `appDataRepairRegistry.ts`. iOS-3B ships
// the 5 safe recipes; iOS-3C will extend the registry to cover the
// remaining 4 (screening issue score x2, set index renumber,
// replacement equivalence audit).
//
// `safeRepairRegistry()` is iOS-3B's canonical factory; tests can
// build a custom registry via `RepairRegistry(definitions:)`.

import Foundation
import IronPathDomain

public enum RepairRegistryError: Error, Equatable, Sendable {
    case duplicateRepairId(String)
}

public struct RepairRegistry: @unchecked Sendable {
    public let definitions: [any RepairDefinition]
    private let byId: [String: any RepairDefinition]

    public init(definitions: [any RepairDefinition]) throws {
        var map: [String: any RepairDefinition] = [:]
        for definition in definitions {
            if map[definition.repairId] != nil {
                throw RepairRegistryError.duplicateRepairId(definition.repairId)
            }
            map[definition.repairId] = definition
        }
        self.definitions = definitions
        self.byId = map
    }

    public func list() -> [any RepairDefinition] { definitions }

    public func byLayer(_ layer: RepairLayer) -> [any RepairDefinition] {
        definitions.filter { $0.layer == layer }
    }

    public func get(_ repairId: String) -> (any RepairDefinition)? {
        byId[repairId]
    }

    public func has(_ repairId: String) -> Bool {
        byId[repairId] != nil
    }
}

/// iOS-3B canonical registry — 5 safe recipes.
public func safeRepairRegistry() -> RepairRegistry {
    do {
        return try RepairRegistry(definitions: [
            SessionLifecycleResidueRepair(),
            ImpossibleDurationRepair(),
            StaleTodayStatusRepair(),
            StaleHealthReadinessRepair(),
            LegacyFinalAdviceIsolationRepair(),
        ])
    } catch {
        // Compile-time bug only — duplicate repairId among static
        // definitions. fatalError surfaces it immediately during the
        // first run rather than letting a silent shadow win.
        fatalError("[IronPathDataHealth] safeRepairRegistry init failed: \(error)")
    }
}
