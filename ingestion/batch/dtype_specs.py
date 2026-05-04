"""Explicit dtype specifications for each Olist CSV file.

Prevents pandas type inference — every column has a declared type.
Timestamp columns are loaded as str and parsed explicitly post-load.
"""

TIMESTAMP_COLUMNS = {
    "orders": [
        "order_purchase_timestamp",
        "order_approved_at",
        "order_delivered_carrier_date",
        "order_delivered_customer_date",
        "order_estimated_delivery_date",
    ],
    "order_reviews": ["review_creation_date", "review_answer_timestamp"],
    "order_items": ["shipping_limit_date"],
}

DTYPE_SPECS: dict[str, dict[str, type]] = {
    "orders": {
        "order_id": str,
        "customer_id": str,
        "order_status": str,
        "order_purchase_timestamp": str,
        "order_approved_at": str,
        "order_delivered_carrier_date": str,
        "order_delivered_customer_date": str,
        "order_estimated_delivery_date": str,
    },
    "order_items": {
        "order_id": str,
        "order_item_id": int,
        "product_id": str,
        "seller_id": str,
        "shipping_limit_date": str,
        "price": float,
        "freight_value": float,
    },
    "customers": {
        "customer_id": str,
        "customer_unique_id": str,
        "customer_zip_code_prefix": str,
        "customer_city": str,
        "customer_state": str,
    },
    "products": {
        "product_id": str,
        "product_category_name": str,
        "product_name_lenght": float,
        "product_description_lenght": float,
        "product_photos_qty": float,
        "product_weight_g": float,
        "product_length_cm": float,
        "product_height_cm": float,
        "product_width_cm": float,
    },
    "sellers": {
        "seller_id": str,
        "seller_zip_code_prefix": str,
        "seller_city": str,
        "seller_state": str,
    },
    "order_payments": {
        "order_id": str,
        "payment_sequential": int,
        "payment_type": str,
        "payment_installments": int,
        "payment_value": float,
    },
    "order_reviews": {
        "review_id": str,
        "order_id": str,
        "review_score": int,
        "review_comment_title": str,
        "review_comment_message": str,
        "review_creation_date": str,
        "review_answer_timestamp": str,
    },
    "geolocation": {
        "geolocation_zip_code_prefix": str,
        "geolocation_lat": float,
        "geolocation_lng": float,
        "geolocation_city": str,
        "geolocation_state": str,
    },
    "product_category_translation": {
        "product_category_name": str,
        "product_category_name_english": str,
    },
}

# Maps internal table name → CSV filename
CSV_FILE_MAP: dict[str, str] = {
    "orders": "olist_orders_dataset.csv",
    "order_items": "olist_order_items_dataset.csv",
    "customers": "olist_customers_dataset.csv",
    "products": "olist_products_dataset.csv",
    "sellers": "olist_sellers_dataset.csv",
    "order_payments": "olist_order_payments_dataset.csv",
    "order_reviews": "olist_order_reviews_dataset.csv",
    "geolocation": "olist_geolocation_dataset.csv",
    "product_category_translation": "product_category_name_translation.csv",
}

# Primary key columns for upsert conflict resolution
PRIMARY_KEYS: dict[str, list[str]] = {
    "orders": ["order_id"],
    "order_items": ["order_id", "order_item_id"],
    "customers": ["customer_id"],
    "products": ["product_id"],
    "sellers": ["seller_id"],
    "order_payments": ["order_id", "payment_sequential"],
    "order_reviews": ["review_id"],
    "geolocation": [],  # no natural PK, append-only
    "product_category_translation": ["product_category_name"],
}
