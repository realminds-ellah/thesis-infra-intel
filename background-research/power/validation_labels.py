import numpy as np
from scipy.stats import beta

# ---------------------------------------------------------------------------
# Angle A is a VALIDATION-LIMITED study. You can APPLY the detector to hundreds
# of projects; you can only TRUST it as far as your labeled set lets you.
# Ground truth = COA-confirmed ghost/mismatched (positives) + field/visually
# confirmed legit (negatives). Question: how many labels buy a credible claim?
# ---------------------------------------------------------------------------

def clopper_pearson(k, n, alpha=0.05):
    lo = beta.ppf(alpha/2, k, n-k+1) if k>0 else 0.0
    hi = beta.ppf(1-alpha/2, k+1, n-k) if k<n else 1.0
    return lo, hi

print("=== Q1: How tight is your RECALL claim vs number of confirmed GHOST projects? ===")
print("(assume detector's true recall = 0.85; you observe ~0.85*n hits)")
for n_pos in [15, 21, 30, 50, 80, 120]:
    k = round(0.85*n_pos)
    lo, hi = clopper_pearson(k, n_pos)
    print(f"  {n_pos:3d} ghost labels -> recall 0.85, 95% CI [{lo:.2f}, {hi:.2f}]  (+/-{(hi-lo)/2:.2f})")

def hanley_mcneil_se(auc, n_pos, n_neg):
    Q1 = auc/(2-auc); Q2 = 2*auc*auc/(1+auc)
    var = (auc*(1-auc) + (n_pos-1)*(Q1-auc**2) + (n_neg-1)*(Q2-auc**2))/(n_pos*n_neg)
    return np.sqrt(var)

print("\n=== Q2: How tight is your overall AUC (discrimination) claim? ===")
print("(assume true AUC = 0.85; balanced labels n_pos = n_neg = n)")
for n in [15, 21, 30, 50, 80, 120]:
    se = hanley_mcneil_se(0.85, n, n)
    print(f"  {n:3d}+{n:3d} labels -> AUC 0.85, SE {se:.3f}, 95% CI [{0.85-1.96*se:.2f}, {min(1,0.85+1.96*se):.2f}]")

print("\n=== Q3: labels needed for a PUBLISHABLE-tight claim (AUC CI half-width < 0.10) ===")
for n in range(10, 200, 2):
    if 1.96*hanley_mcneil_se(0.85, n, n) < 0.10:
        print(f"  need ~{n} ghost + ~{n} legit (={2*n} labeled total) for AUC 95% CI half-width < 0.10"); break

print("\n=== Q4: can COA's set alone carry it? ===")
lo,hi = clopper_pearson(round(0.85*21), 21)
print(f"  COA ~21 ghost only: recall CI [{lo:.2f},{hi:.2f}] -> too wide to headline, but VALID as an independent-audit check.")
print("  Verdict: COA labels validate direction; you must ADD ~50-80 self-verified labels/class")
print("  (eyeball high-res imagery for a sample) to make a tight, defensible claim.")
