import SwiftUI

// ═══════════════════════════════════════════════════════════════════════════
// LineItemsEditor — briques partagées des éditeurs de devis & factures :
// section des lignes, éditeur d'une ligne, remise globale, totaux.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ligne dans la liste de l'éditeur ─────────────────────────────────────
struct QuoteItemRow: View {
    let item: QuoteItem

    var body: some View {
        if item.isSection {
            HStack(spacing: 8) {
                Image(systemName: "text.append")
                    .font(.caption)
                    .foregroundStyle(Theme.primary)
                Text(item.displayLabel)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.foreground)
            }
        } else {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayLabel)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                HStack {
                    Text("\(Format.trimNumber(item.quantity)) \(item.unit) × \(Format.currency(item.unitPriceHT))")
                        .font(.caption)
                        .foregroundStyle(Theme.mutedForeground)
                    Spacer(minLength: 8)
                    Text(Format.currency(QuoteMath.lineAmounts(item).netHT))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.foreground)
                }
            }
        }
    }
}

// ─── Section "Lignes" : liste éditable + ajout ────────────────────────────
struct LineItemsSection: View {
    @Binding var items: [QuoteItem]

    var body: some View {
        Section {
            if items.isEmpty {
                Text("Aucune ligne pour l'instant")
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedForeground)
            }
            ForEach($items) { $item in
                NavigationLink {
                    QuoteItemEditorView(item: $item)
                } label: {
                    QuoteItemRow(item: item)
                }
            }
            .onDelete { offsets in
                items.remove(atOffsets: offsets)
            }

            Button {
                items.append(QuoteItem(line: true))
            } label: {
                Label("Ajouter une ligne", systemImage: "plus.circle.fill")
            }
            Button {
                items.append(QuoteItem(line: false))
            } label: {
                Label("Ajouter un chapitre", systemImage: "text.append")
            }
        } header: {
            Text("Lignes")
        } footer: {
            Text("Glisse une ligne vers la gauche pour la supprimer.")
        }
        .listRowBackground(Theme.card)
    }
}

// ─── Éditeur d'une ligne / d'un chapitre ──────────────────────────────────
struct QuoteItemEditorView: View {
    @Binding var item: QuoteItem

    var body: some View {
        Form {
            if item.isSection {
                Section("Chapitre") {
                    TextField("Titre du chapitre", text: $item.title)
                }
                .listRowBackground(Theme.card)
            } else {
                Section("Désignation") {
                    TextField("Désignation de la prestation",
                              text: $item.description, axis: .vertical)
                        .lineLimit(2...6)
                }
                .listRowBackground(Theme.card)

                Section("Quantité & prix") {
                    DecimalField("Quantité", value: $item.quantity)
                    HStack {
                        Text("Unité")
                        Spacer()
                        TextField("u", text: $item.unit)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                    }
                    DecimalField("Prix unitaire HT", value: $item.unitPriceHT, suffix: "€")
                    Picker("TVA", selection: $item.vatRate) {
                        Text("20 %").tag(20.0)
                        Text("10 %").tag(10.0)
                        Text("5,5 %").tag(5.5)
                        Text("0 %").tag(0.0)
                    }
                    Picker("Type", selection: $item.lineType) {
                        Text("Non spécifié").tag("")
                        Text("Pose").tag("P")
                        Text("Fourniture").tag("F")
                        Text("Pose + fourniture").tag("PF")
                    }
                }
                .listRowBackground(Theme.card)

                Section("Remise sur la ligne") {
                    Picker("Type de remise", selection: $item.discountMode) {
                        Text("Aucune").tag("none")
                        Text("Pourcentage").tag("percent")
                        Text("Montant").tag("amount")
                    }
                    if item.discountMode == "percent" {
                        DecimalField("Remise", value: $item.discountPercent, suffix: "%")
                    } else if item.discountMode == "amount" {
                        DecimalField("Remise", value: $item.discountAmount, suffix: "€")
                    }
                }
                .listRowBackground(Theme.card)

                Section("Total de la ligne") {
                    HStack {
                        Text("HT net").foregroundStyle(Theme.mutedForeground)
                        Spacer()
                        Text(Format.currency(QuoteMath.lineAmounts(item).netHT))
                            .foregroundStyle(Theme.foreground)
                    }
                    HStack {
                        Text("TTC").fontWeight(.semibold)
                        Spacer()
                        Text(Format.currency(QuoteMath.lineTotalTTC(item)))
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.foreground)
                    }
                }
                .listRowBackground(Theme.card)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle(item.isSection ? "Chapitre" : "Ligne")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// ─── Section "Remise globale" ─────────────────────────────────────────────
struct GlobalDiscountSection: View {
    @Binding var mode: String
    @Binding var percent: Double
    @Binding var amount: Double

    var body: some View {
        Section("Remise globale") {
            Picker("Type", selection: $mode) {
                Text("Aucune").tag("none")
                Text("Pourcentage").tag("percent")
                Text("Montant").tag("amount")
            }
            if mode == "percent" {
                DecimalField("Remise", value: $percent, suffix: "%")
            } else if mode == "amount" {
                DecimalField("Remise", value: $amount, suffix: "€")
            }
        }
        .listRowBackground(Theme.card)
    }
}

// ─── Section "Totaux" (recalcul live) ─────────────────────────────────────
struct EditorTotalsSection: View {
    let totals: QuoteMath.Totals

    var body: some View {
        Section("Totaux") {
            totalRow("Sous-total HT", totals.subtotalHT)
            if totals.globalDiscount > 0 {
                totalRow("Remise globale", -totals.globalDiscount)
            }
            totalRow("Total HT", totals.totalHT)
            ForEach(totals.vatLines) { line in
                totalRow("TVA \(Format.trimNumber(line.rate)) %", line.tax)
            }
            HStack {
                Text("Total TTC").fontWeight(.bold)
                Spacer()
                Text(Format.currency(totals.totalTTC)).fontWeight(.bold)
            }
            .foregroundStyle(Theme.foreground)
        }
        .listRowBackground(Theme.card)
    }

    private func totalRow(_ label: String, _ value: Double) -> some View {
        HStack {
            Text(label).foregroundStyle(Theme.mutedForeground)
            Spacer()
            Text(Format.currency(value)).foregroundStyle(Theme.foreground)
        }
        .font(.subheadline)
    }
}
