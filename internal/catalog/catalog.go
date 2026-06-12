package catalog

const DepthFT = 10

// Device names, exported so other packages refer to them without magic strings.
const (
	MegapackXL  = "MegapackXL"
	Megapack2   = "Megapack2"
	Megapack    = "Megapack"
	PowerPack   = "PowerPack"
	Transformer = "Transformer"
)

type Device struct {
	Name        string  `json:"name"`
	WidthFT     int     `json:"widthFt"`
	DepthFT     int     `json:"depthFt"`
	EnergyMWh   float64 `json:"energyMwh"`
	CostUSD     int     `json:"costUsd"`
	ReleaseYear int     `json:"releaseYear,omitempty"`
	IsBattery   bool    `json:"isBattery"`
}

var devices = []Device{
	{Name: MegapackXL, WidthFT: 40, DepthFT: DepthFT, EnergyMWh: 4, CostUSD: 120000, ReleaseYear: 2022, IsBattery: true},
	{Name: Megapack2, WidthFT: 30, DepthFT: DepthFT, EnergyMWh: 3, CostUSD: 80000, ReleaseYear: 2021, IsBattery: true},
	{Name: Megapack, WidthFT: 30, DepthFT: DepthFT, EnergyMWh: 2, CostUSD: 50000, ReleaseYear: 2005, IsBattery: true},
	{Name: PowerPack, WidthFT: 10, DepthFT: DepthFT, EnergyMWh: 1, CostUSD: 10000, ReleaseYear: 2000, IsBattery: true},
	{Name: Transformer, WidthFT: 10, DepthFT: DepthFT, EnergyMWh: -0.5, CostUSD: 10000, IsBattery: false},
}

var byName = func() map[string]Device {
	m := make(map[string]Device, len(devices))
	for _, d := range devices {
		m[d.Name] = d
	}
	return m
}()

// All returns a copy of the full catalog in canonical order (batteries widest
// first, then the transformer). The copy keeps callers from mutating the catalog.
func All() []Device {
	out := make([]Device, len(devices))
	copy(out, devices)
	return out
}

// Batteries returns only the user-selectable battery devices, widest first.
func Batteries() []Device {
	out := make([]Device, 0, len(devices))
	for _, d := range devices {
		if d.IsBattery {
			out = append(out, d)
		}
	}
	return out
}

// Get returns the device with the given name and whether it exists.
func Get(name string) (Device, bool) {
	d, ok := byName[name]
	return d, ok
}

// TransformerDevice returns the support transformer spec.
func TransformerDevice() Device {
	return byName[Transformer]
}
