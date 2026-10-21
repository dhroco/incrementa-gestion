#!/usr/bin/env python3
"""Baja de la API pública de precios de Azure (sin login) los precios en USD de los componentes
del sistema en Brazil South (y Static Web Apps, que es global). Deja el resultado en
precios-azure.json, al lado de este script, para calcular el presupuesto mensual.

   python3 infra/azure/scripts/precios-azure.py
"""
import json, os, urllib.parse, urllib.request

API = "https://prices.azure.com/api/retail/prices"
R = "armRegionName eq 'brazilsouth'"
CONSULTAS = {
    "postgres": f"{R} and serviceName eq 'Azure Database for PostgreSQL' and contains(productName,'Flexible Server')",
    "container_apps": f"{R} and serviceName eq 'Azure Container Apps'",
    "acr": f"{R} and serviceName eq 'Container Registry'",
    "postgres_disco": f"{R} and serviceName eq 'Azure Database for PostgreSQL' and contains(meterName,'Storage')",
    "postgres_disco_ssd": f"{R} and contains(productName,'PostgreSQL') and contains(meterName,'Data Stored')",
    "private_link": "contains(productName,'Private Link') and contains(meterName,'Private Endpoint')",
    "dns": "serviceName eq 'Azure DNS' and contains(meterName,'Private')",
    "log_analytics": f"{R} and serviceName eq 'Log Analytics'",
    "storage": f"{R} and serviceName eq 'Storage' and productName eq 'Blob Storage' and contains(skuName,'Hot LRS')",
    "key_vault": f"{R} and serviceName eq 'Key Vault' and skuName eq 'Standard'",
    "static_web_apps": "serviceName eq 'Azure App Service' and contains(productName,'Static Web')",
}

def bajar(filtro):
    url = API + "?" + urllib.parse.urlencode({"currencyCode": "USD", "$filter": filtro})
    filas = []
    while url:
        with urllib.request.urlopen(url, timeout=30) as r:
            d = json.load(r)
        for i in d.get("Items", []):
            if i.get("type") != "Consumption":
                continue
            filas.append({k: i.get(k) for k in ("productName", "skuName", "meterName", "unitPrice", "unitOfMeasure", "armRegionName", "tierMinimumUnits")})
        url = d.get("NextPageLink")
    return filas

salida = {}
for nombre, filtro in CONSULTAS.items():
    try:
        salida[nombre] = bajar(filtro)
        print(f"{nombre:16} {len(salida[nombre]):4} precios")
    except Exception as e:  # noqa: BLE001
        salida[nombre] = {"error": str(e)}
        print(f"{nombre:16} ERROR {e}")

destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "precios-azure.json")
with open(destino, "w") as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)
print("Listo:", destino)
