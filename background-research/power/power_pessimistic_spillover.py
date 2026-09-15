import numpy as np
rng = np.random.default_rng(11)
T, N_c, RHO, NREPS = 30, 200, 0.30, 500

def within(X):
    return X - X.mean(0,keepdims=True) - X.mean(1,keepdims=True) + X.mean()

def twfe(Y, Dlist):
    # multi-regressor two-way within OLS with cluster(unit)-robust SE; returns (coef,se) for reg 0
    Yt = within(Y).ravel()
    Xs = [within(D).ravel() for D in Dlist]
    X = np.column_stack(Xs)
    N,Tt = Y.shape
    XtX = X.T@X; beta = np.linalg.solve(XtX, X.T@Yt)
    resid = Yt - X@beta
    # cluster by unit
    idx = np.repeat(np.arange(N), Tt)
    k = X.shape[1]; meat = np.zeros((k,k))
    for i in range(N):
        Xi = X[idx==i]; ri = resid[idx==i]
        s = Xi.T@ri; meat += np.outer(s,s)
    XtXinv = np.linalg.inv(XtX)
    V = XtXinv@meat@XtXinv
    return beta[0], np.sqrt(V[0,0])

def panel(N_t, sigma, tau_dir, tau_spill=0.0, frac_spill=0.0):
    N = N_t + N_c
    ufe = rng.normal(0,0.15,N)[:,None]; tfe = rng.normal(0,0.10,T)[None,:]
    eps = np.zeros((N,T)); eps[:,0]=rng.normal(0,sigma,N)
    isd = sigma*np.sqrt(1-RHO**2)
    for t in range(1,T): eps[:,t]=RHO*eps[:,t-1]+rng.normal(0,isd,N)
    Ddir = np.zeros((N,T)); Dsp = np.zeros((N,T))
    starts = rng.integers(T//3,2*T//3,size=N_t)
    for i,s in enumerate(starts): Ddir[i,s:]=1.0
    # spillover: a fraction of the CONTROL pool are downstream-exposed after some project completes
    if frac_spill>0:
        n_sp = int(frac_spill*N_c)
        sp_units = N_t + rng.choice(N_c, n_sp, replace=False)
        for u in sp_units:
            s = rng.integers(T//3,2*T//3); Dsp[u,s:]=1.0
    Y = ufe+tfe+tau_dir*Ddir+tau_spill*Dsp+eps
    return Y, Ddir, Dsp

def power_direct(N_t, sigma, tau):
    r=0
    for _ in range(NREPS):
        Y,Dd,_=panel(N_t,sigma,tau); b,se=twfe(Y,[Dd]); r+= abs(b/se)>1.96
    return r/NREPS

def power_spill(N_t, sigma, tau_sp, frac):
    # estimand of interest is the SPILLOVER coef (put it first)
    r=0
    for _ in range(NREPS):
        Y,Dd,Ds=panel(N_t,sigma,-0.05,tau_sp,frac); b,se=twfe(Y,[Ds,Dd]); r+= abs(b/se)>1.96
    return r/NREPS

print("== DIRECT effect, PESSIMISTIC SAR noise sigma=0.25 ==")
for N_t in [20,30,50,75,100,150]:
    print(f"  N_t={N_t:4d}  tau=-0.05 power={power_direct(N_t,0.25,-0.05):0.2f}   tau=-0.03 power={power_direct(N_t,0.25,-0.03):0.2f}")

print("== SPILLOVER effect tau_spill=+0.04 (downstream WORSENING), sigma=0.18, 25% of area downstream-exposed ==")
for N_t in [30,50,75,100,150,200]:
    print(f"  N_t={N_t:4d}  power(detect spillover)={power_spill(N_t,0.18,0.04,0.25):0.2f}")
