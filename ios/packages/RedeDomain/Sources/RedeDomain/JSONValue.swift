// JSONValue — M1-1 最小 JSON 树。
//
// 职责只有一个：让 AppData 把整棵 JSON（含未知字段）verbatim 持有并往返。
// 合同是语义等值（键和值全保留），不承诺字节级 key 顺序——legacy 的
// canonical stringify / 哈希 parity 机器已随 M1-0 退役，不得回潮。
// 整数与浮点分开存（.int/.double），保证整数往返不变形。

public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case int(Int64)
    case double(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

extension JSONValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let int = try? container.decode(Int64.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let bool): try container.encode(bool)
        case .int(let int): try container.encode(int)
        case .double(let double): try container.encode(double)
        case .string(let string): try container.encode(string)
        case .array(let array): try container.encode(array)
        case .object(let object): try container.encode(object)
        }
    }
}

extension JSONValue {
    public var asString: String? {
        guard case .string(let string) = self else { return nil }
        return string
    }

    public var asBool: Bool? {
        guard case .bool(let bool) = self else { return nil }
        return bool
    }

    public var asInt: Int? {
        guard case .int(let int) = self else { return nil }
        return Int(exactly: int)
    }

    /// 数值读取口径：JSON 整数字面量也可作为 Double 读出（如 weight: 80）。
    public var asDouble: Double? {
        switch self {
        case .double(let double): return double
        case .int(let int): return Double(int)
        default: return nil
        }
    }

    public var asArray: [JSONValue]? {
        guard case .array(let array) = self else { return nil }
        return array
    }

    public var asObject: [String: JSONValue]? {
        guard case .object(let object) = self else { return nil }
        return object
    }

    public var asStringArray: [String]? {
        guard let array = asArray else { return nil }
        let strings = array.compactMap(\.asString)
        return strings.count == array.count ? strings : nil
    }
}
