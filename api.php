<?php
/**
 * Machines Dealer Production API Bridge
 * Replaces dev-server.py for cPanel/PHP environments.
 */

header('Content-Type: application/json');

// 1. Identify Action
$requestUri = $_SERVER['REQUEST_URI'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if (empty($action)) {
    // Fallback if .htaccess didn't pass action
    $parts = explode('/api/', $requestUri);
    $action = end($parts);
}

// 2. Map Actions to Files
$mapping = [
    'save-inventory' => 'inventory.json',
    'save-news' => 'news.json',
    'save-blogs' => 'blogs.json',
    'save-videos' => 'videos.json',
    'save-staff' => 'our_staff.json',
    'save-pages' => 'pages.json',
    'save-settings' => 'settings.json',
    'save-subscribers' => 'subscribers.json',
    'subscribe' => 'subscribers.json'
];

if (!isset($mapping[$action]) && $action !== 'sync-reviews') {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Invalid API action: $action"]);
    exit;
}

// 3. Handle POST Data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawData = file_get_contents('php://input');
    $jsonData = json_decode($rawData, true);

    if (!$jsonData) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid JSON data"]);
        exit;
    }

    $filename = $mapping[$action];
    $filePath = __DIR__ . '/data/' . $filename;

    // 4. Create Backup
    if (file_exists($filePath)) {
        $backupPath = $filePath . '.' . date('YmdHis') . '.bak';
        copy($filePath, $backupPath);
    }

    // 5. Save Data
    if ($action === 'subscribe') {
        $subs = json_decode(file_get_contents($filePath), true) ?: [];
        $email = $jsonData['email'] ?? '';

        if (!$email) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Email is required"]);
            exit;
        }

        // Check for duplicates
        foreach ($subs as $s) {
            if ($s['email'] === $email) {
                echo json_encode(["status" => "success", "message" => "Already subscribed"]);
                exit;
            }
        }

        $subs[] = [
            'email' => $email,
            'date' => date('Y-m-d H:i:s')
        ];

        if (file_put_contents($filePath, json_encode($subs, JSON_PRETTY_PRINT))) {
            echo json_encode(["status" => "success", "message" => "Subscription successful"]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Failed to save subscriber"]);
        }
    } else {
        if (file_put_contents($filePath, json_encode($jsonData, JSON_PRETTY_PRINT))) {
            echo json_encode(["status" => "success", "message" => "$action saved and backed up"]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Failed to write to $filename. Check folder permissions."]);
        }
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
