import Foundation

// ═══════════════════════════════════════════════════════════════════════════
// DecodingHelpers — décodage tolérant des réponses API.
//
// L'API BatiDesk s'appuie sur MySQL : mysql2 renvoie souvent les DECIMAL
// (totalHT, totalTTC…) sous forme de String, et certaines colonnes peuvent
// être null. Ces helpers acceptent String / Int / Double / Bool de façon
// interchangeable et ne lèvent jamais d'erreur sur une clé absente — on
// préfère une valeur par défaut à un crash de décodage.
// ═══════════════════════════════════════════════════════════════════════════

extension KeyedDecodingContainer {
    /// Chaîne — accepte aussi un nombre ou un booléen, "" si absent/null.
    func str(_ key: Key) -> String {
        if let v = try? decode(String.self, forKey: key) { return v }
        if let v = try? decode(Int.self, forKey: key) { return String(v) }
        if let v = try? decode(Double.self, forKey: key) { return Format.trimNumber(v) }
        if let v = try? decode(Bool.self, forKey: key) { return v ? "true" : "false" }
        return ""
    }

    /// Nombre décimal — accepte aussi une String ("1234.50" ou "1234,50"), 0 si absent.
    func dbl(_ key: Key) -> Double {
        if let v = try? decode(Double.self, forKey: key) { return v }
        if let v = try? decode(Int.self, forKey: key) { return Double(v) }
        if let v = try? decode(String.self, forKey: key) {
            return Double(v.replacingOccurrences(of: ",", with: ".")) ?? 0
        }
        return 0
    }

    /// Entier — accepte aussi Double ou String, 0 si absent.
    func intVal(_ key: Key) -> Int {
        if let v = try? decode(Int.self, forKey: key) { return v }
        if let v = try? decode(Double.self, forKey: key) { return Int(v) }
        if let v = try? decode(String.self, forKey: key) { return Int(v) ?? 0 }
        return 0
    }

    /// Booléen — accepte aussi 0/1 ou "true"/"1", false si absent.
    func boolVal(_ key: Key) -> Bool {
        if let v = try? decode(Bool.self, forKey: key) { return v }
        if let v = try? decode(Int.self, forKey: key) { return v != 0 }
        if let v = try? decode(String.self, forKey: key) {
            return v == "true" || v == "1"
        }
        return false
    }
}
