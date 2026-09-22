"""Model definitions for the CareTwin training package (PyTorch)."""
import torch
import torch.nn as nn


class Forecaster(nn.Module):
    """LSTM / Bi-LSTM next-step heart-rate forecaster."""
    def __init__(self, bi=False, hidden=64, layers=2):
        super().__init__()
        self.lstm = nn.LSTM(1, hidden, layers, batch_first=True, dropout=0.2, bidirectional=bi)
        self.fc = nn.Linear(hidden * (2 if bi else 1), 1)

    def forward(self, x):
        o, _ = self.lstm(x)
        return self.fc(o[:, -1, :]).squeeze(-1)


class SleepLSTM(nn.Module):
    """Sequence classifier for sleep stage from [bpm, spo2, hour] windows."""
    def __init__(self, n_classes, in_feat=3, hidden=64, layers=2):
        super().__init__()
        self.lstm = nn.LSTM(in_feat, hidden, layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden, n_classes)

    def forward(self, x):
        o, _ = self.lstm(x)
        return self.fc(o[:, -1, :])


# ---- Conditional WGAN-GP: synthesises (T, 2) sequences of (bpm_z, spo2_z) per sleep stage ----
class Generator(nn.Module):
    def __init__(self, zdim, ncond, T, feat=2, hidden=128):
        super().__init__()
        self.T, self.feat = T, feat
        self.emb = nn.Embedding(ncond, ncond)
        self.net = nn.Sequential(
            nn.Linear(zdim + ncond, hidden), nn.LeakyReLU(0.2, inplace=True),
            nn.Linear(hidden, hidden), nn.LeakyReLU(0.2, inplace=True),
            nn.Linear(hidden, T * feat),
        )

    def forward(self, z, c):
        h = torch.cat([z, self.emb(c)], dim=1)
        return self.net(h).view(-1, self.T, self.feat)


class Discriminator(nn.Module):
    """Critic (no sigmoid — Wasserstein)."""
    def __init__(self, ncond, T, feat=2, hidden=128):
        super().__init__()
        self.emb = nn.Embedding(ncond, ncond)
        self.net = nn.Sequential(
            nn.Linear(T * feat + ncond, hidden), nn.LeakyReLU(0.2, inplace=True),
            nn.Linear(hidden, hidden), nn.LeakyReLU(0.2, inplace=True),
            nn.Linear(hidden, 1),
        )

    def forward(self, x, c):
        h = torch.cat([x.reshape(x.size(0), -1), self.emb(c)], dim=1)
        return self.net(h).squeeze(-1)


def gradient_penalty(D, real, fake, c, device):
    a = torch.rand(real.size(0), 1, 1, device=device)
    inter = (a * real + (1 - a) * fake).requires_grad_(True)
    d = D(inter, c)
    g = torch.autograd.grad(d, inter, torch.ones_like(d), create_graph=True, retain_graph=True)[0]
    g = g.reshape(g.size(0), -1)
    return ((g.norm(2, dim=1) - 1) ** 2).mean()
