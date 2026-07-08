import numpy as np

rng = np.random.default_rng(7)

# ---- Design parameters (stated, defensible, deliberately not optimistic) ----
T          = 30      # time periods (SAR-observed flood-relevant epochs over study window)
N_c        = 200     # untreated ("never-treated"/not-yet-treated) barangays available as controls
SIGMA_EPS  = 0.18    # idiosyncratic within-barangay SD of inundation fraction (local rain + SAR error)
RHO        = 0.30    # AR(1) serial correlation in the barangay outcome (Bertrand-Duflo-Mullainathan)
TAU_TRUE   = -0.05   # true effect: 5 percentage-point reduction in inundation fraction (~15-20% relative)
NREPS      = 500

def make_panel(N_t):
    N = N_t + N_c
    # two-way FE (magnitudes irrelevant: absorbed by the estimator)
    unit_fe = rng.normal(0, 0.15, N)[:,None]
    time_fe = rng.normal(0, 0.10, T)[None,:]        # common rainfall shock -> absorbed by time FE
    # AR(1) idiosyncratic noise
    eps = np.zeros((N, T))
    eps[:,0] = rng.normal(0, SIGMA_EPS, N)
    innov_sd = SIGMA_EPS*np.sqrt(1-RHO**2)
    for t in range(1,T):
        eps[:,t] = RHO*eps[:,t-1] + rng.normal(0, innov_sd, N)
    # staggered adoption: treated units switch on at random dates in the middle third
    D = np.zeros((N,T))
    starts = rng.integers(T//3, 2*T//3, size=N_t)
    for i,s in enumerate(starts):
        D[i, s:] = 1.0
    Y = unit_fe + time_fe + TAU_TRUE*D + eps
    return Y, D

def twfe_estimate(Y, D):
    # two-way within transform
    def within(X):
        return X - X.mean(0,keepdims=True) - X.mean(1,keepdims=True) + X.mean()
    Yt, Dt = within(Y), within(D)
    num = (Dt*Yt).sum(); den = (Dt*Dt).sum()
    tau = num/den
    resid = Yt - tau*Dt
    # cluster-robust (by unit) sandwich SE
    N = Y.shape[0]
    meat = 0.0
    for i in range(N):
        s = (Dt[i]*resid[i]).sum()
        meat += s*s
    se = np.sqrt(meat)/den
    return tau, se

for N_t in [10,20,30,50,75,100,150,200]:
    rejects = 0
    for _ in range(NREPS):
        Y,D = make_panel(N_t)
        tau,se = twfe_estimate(Y,D)
        if abs(tau/se) > 1.96:
            rejects += 1
    print(f"N_treated={N_t:4d}   power(detect tau=-0.05) = {rejects/NREPS:0.2f}")
