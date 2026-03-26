#!/usr/bin/env python3
"""
Calculate NPS metrics from contract data
NPS = % Promoters - % Detractors
Promoters: 9-10
Passives: 7-8
Detractors: 0-6
"""

# Parse the data
data = [
    ("MV", "2025-10-08", "55 998 8820", "Mohammad Hans Dastmaltchi", 10, ""),
    ("MV", "2025-09-23", "50 226 9999", "Idriss Stephane Makdoud", 10, ""),
    ("MV", "2025-03-13", "58 513 2566", "Silvia Zarazaga Alfaro", 10, ""),
    ("MV", "2025-08-19", "971506361099", "Marie Eliane Wakil", 10, ""),
    ("MV", "2024-12-05", "58 533 3888", "Sami Bouremoum", 9, ""),
    ("MV", "2023-10-06", "54 439 2580", "Alexis Boris Edouard Brin", 10, ""),
    ("MV", "2024-10-01", "56 264 4288", "Susanne Gamers", 8, ""),
    ("MV", "2022-12-20", "52 692 3289", "Linbert Salcedo Peneda", 10, ""),
    ("MV", "2026-02-01", "971504480723", "Abhishek Benjamin Sunil Benjamin", 10, ""),
    ("MV", "2025-11-01", "971585692515", "Laith Sakka Amini", 10, ""),
    ("MV", "2025-12-08", "971506402130", "Mary Mitchelle Formeloza Ebron", 9, ""),
    ("MV", "2026-01-27", "971567800282", "MA JOSIE BELLE CUALES YABUT", 9, ""),
    ("CC", "2025-06-14", "971504348440", "Basma Naji Hachouche", 7, ""),
    ("MV", "2024-04-02", "971509839968", "Hadia Georges Issa", 8, "preferred app over WA"),
    ("CC", "2025-11-21", "971503246133", "Walid Adib Ahmed Elarabi", 10, ""),
    ("MV", "2023-11-01", "971527513982", "Said Talal Beydoun", 10, ""),
]

def calculate_nps(scores):
    """Calculate NPS from a list of scores"""
    if not scores:
        return None, None, None, None, None
    
    total = len(scores)
    promoters = sum(1 for s in scores if s >= 9)
    passives = sum(1 for s in scores if 7 <= s <= 8)
    detractors = sum(1 for s in scores if s <= 6)
    
    pct_promoters = (promoters / total) * 100
    pct_passives = (passives / total) * 100
    pct_detractors = (detractors / total) * 100
    
    nps = pct_promoters - pct_detractors
    
    return nps, promoters, passives, detractors, total

# Separate data by contract type
mv_scores = [nps for contract_type, _, _, _, nps, _ in data if contract_type == "MV"]
cc_scores = [nps for contract_type, _, _, _, nps, _ in data if contract_type == "CC"]
all_scores = [nps for _, _, _, _, nps, _ in data]

# Calculate NPS for each group
overall_nps, overall_promoters, overall_passives, overall_detractors, overall_total = calculate_nps(all_scores)
mv_nps, mv_promoters, mv_passives, mv_detractors, mv_total = calculate_nps(mv_scores)
cc_nps, cc_promoters, cc_passives, cc_detractors, cc_total = calculate_nps(cc_scores)

# Display results
print("=" * 70)
print("NPS CALCULATION RESULTS")
print("=" * 70)
print()
print("OVERALL METRICS:")
print(f"  Total Responses: {overall_total}")
print(f"  Promoters (9-10): {overall_promoters} ({overall_promoters/overall_total*100:.1f}%)")
print(f"  Passives (7-8): {overall_passives} ({overall_passives/overall_total*100:.1f}%)")
print(f"  Detractors (0-6): {overall_detractors} ({overall_detractors/overall_total*100:.1f}%)")
print(f"  NPS Score: {overall_nps:.1f}")
print()
print("MV CONTRACT TYPE:")
print(f"  Total Responses: {mv_total}")
print(f"  Promoters (9-10): {mv_promoters} ({mv_promoters/mv_total*100:.1f}%)")
print(f"  Passives (7-8): {mv_passives} ({mv_passives/mv_total*100:.1f}%)")
print(f"  Detractors (0-6): {mv_detractors} ({mv_detractors/mv_total*100:.1f}%)")
print(f"  NPS Score: {mv_nps:.1f}")
print()
print("CC CONTRACT TYPE:")
print(f"  Total Responses: {cc_total}")
print(f"  Promoters (9-10): {cc_promoters} ({cc_promoters/cc_total*100:.1f}%)")
print(f"  Passives (7-8): {cc_passives} ({cc_passives/cc_total*100:.1f}%)")
print(f"  Detractors (0-6): {cc_detractors} ({cc_detractors/cc_total*100:.1f}%)")
print(f"  NPS Score: {cc_nps:.1f}")
print()
print("=" * 70)

